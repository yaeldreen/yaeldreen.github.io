import { RESOURCES, ResourceKey } from '../../core/game-data/resources';
import { formatNumber } from '../../shared/utils/format';
import { BuildingLevel, FOOD_DEPOT_LEVELS, RESOURCE_DEPOT_LEVELS, StorageLevel } from '../buildings/buildings.data';
import { BUILDING_GUIDES, BuildingGuide, BuildingId, PREREQUISITES } from '../buildings/buildings.guides';

type StorageId = 'resourceDepot' | 'foodDepot';

interface Storage {
  id: StorageId;
  /** Ressources dont le coût unitaire doit tenir dans la capacité du dépôt. */
  resources: readonly ResourceKey[];
  rows: readonly StorageLevel[];
}

const STORAGES: readonly Storage[] = [
  { id: 'resourceDepot', resources: ['stone', 'wood', 'iron'], rows: RESOURCE_DEPOT_LEVELS },
  { id: 'foodDepot', resources: ['food'], rows: FOOD_DEPOT_LEVELS },
];

const RESOURCE_LABELS = Object.fromEntries(RESOURCES.map((r) => [r.key, r.label.toLowerCase()])) as Record<ResourceKey, string>;

class PlanBlocked extends Error {}

const guideOf = (id: BuildingId): BuildingGuide => BUILDING_GUIDES.find((g) => g.id === id)!;

const UNIT_SECONDS: Record<string, number> = { j: 86400, h: 3600, min: 60, secondes: 1, sec: 1, s: 1 };

/** Lit les temps de construction des tableaux : "0:00:03:20" (j:h:min:s), "1 j 4 h 50 min", "1min 47s", "55 sec"… */
export function parseDuration(text: string): number {
  const t = text.trim();
  const colon = /^(\d+):(\d+):(\d+):(\d+)$/.exec(t);
  if (colon) {
    const [d, h, m, s] = colon.slice(1).map(Number);
    return ((d * 24 + h) * 60 + m) * 60 + s;
  }
  if (t === '0') return 0;

  let total = 0;
  let consumed = '';
  for (const m of t.matchAll(/(\d+)\s*(secondes|sec|min|j|h|s)(?![a-z])/g)) {
    total += Number(m[1]) * UNIT_SECONDS[m[2]];
    consumed += m[0];
  }
  if (consumed.replace(/\s/g, '') !== t.replace(/\s/g, '')) throw new Error(`Durée illisible : "${text}"`);
  return total;
}

export interface SimulationInput {
  buildingId: BuildingId;
  currentLevel: number;
  targetLevel: number;
  resourceDepotLevel: number;
  foodDepotLevel: number;
  /** Niveaux actuels des bâtiments utiles aux prérequis ; absent = niveau 0. */ levels?: Partial<Record<BuildingId, number>>;
}

export interface PrerequisiteField {
  buildingId: BuildingId;
  label: string;
  /** Niveau demandé par le prérequis (le plus élevé s'il y en a plusieurs). */ required: number;
}

/**
 * Bâtiments dont il faut connaître le niveau : les prérequis du bâtiment visé s'il est au niveau 0, puis ceux
 * de chaque prérequis encore au niveau 0. Les dépôts ont déjà leurs propres champs.
 */
export function prerequisiteFields(input: SimulationInput): PrerequisiteField[] {
  const levelOf = (id: BuildingId): number => (id === input.buildingId ? input.currentLevel : (input.levels?.[id] ?? 0));
  const fields = new Map<BuildingId, PrerequisiteField>();
  const visit = (id: BuildingId): void => {
    if (levelOf(id) > 0) return;
    for (const [dependency, required] of Object.entries(PREREQUISITES[id] ?? {}) as [BuildingId, number][]) {
      const known = fields.get(dependency);
      fields.set(dependency, { buildingId: dependency, label: guideOf(dependency).label, required: Math.max(required, known?.required ?? 0) });
      visit(dependency);
    }
  };
  visit(input.buildingId);
  return [...fields.values()].filter((f) => f.buildingId !== 'resourceDepot' && f.buildingId !== 'foodDepot');
}

export interface PlanStep {
  buildingId: BuildingId;
  label: string;
  /** Niveau atteint à la fin de l'étape */ level: number;
  row: BuildingLevel;
  seconds: number;
  /** true = amélioration de dépôt imposée par la capacité */ isStorage: boolean;
  /** true = construction imposée par les prérequis d'un bâtiment */ isPrerequisite: boolean;
  explanation: string;
}

export interface SimulationPlan {
  steps: PlanStep[];
  totalSeconds: number;
  totals: Record<ResourceKey, number>;
  storageSeconds: number;
  /** Raison de l'arrêt si le plan ne peut pas aller au bout (dépôt déjà au maximum). */
  blocker?: string;
}

/**
 * Le niveau N d'un tableau donne le coût pour atteindre le niveau N.
 * Avant chaque construction, chaque coût unitaire doit tenir dans la capacité du dépôt concerné
 * (pierre/bois/fer → Dépôt de ressources, nourriture → Dépôt de nourriture) ; sinon le dépôt
 * est amélioré d'abord, lui-même sous la même contrainte. Les constructions sont enchaînées
 * une par une, le temps total est donc la somme des temps.
 * Le niveau 1 d'un bâtiment demande ses prérequis, construits d'abord, avec leurs propres prérequis et dépôts.
 * Le Quartier général et les dépôts ne sont pas soumis à la capacité pour leur niveau 1 : ils se demandent l'un l'autre,
 * et la capacité d'un village sans dépôt n'est pas connue.
 */
export function simulateUpgrades(input: SimulationInput): SimulationPlan {
  const levels = new Map<BuildingId, number>([
    ...(Object.entries(input.levels ?? {}) as [BuildingId, number][]),
    ['resourceDepot', input.resourceDepotLevel],
    ['foodDepot', input.foodDepotLevel],
    [input.buildingId, input.currentLevel],
  ]);
  const steps: PlanStep[] = [];

  const capacityOf = (storage: Storage): number =>
    storage.rows.find((r) => r.level === levels.get(storage.id))?.capacity ?? 0;

  type StepKind = 'target' | 'storage' | 'prerequisite';

  const build = (id: BuildingId, explain: (row: BuildingLevel, label: string) => string, kind: StepKind): void => {
    const guide = guideOf(id);
    const next = (levels.get(id) ?? 0) + 1;
    const row = guide.rows.find((r) => r.level === next);
    if (!row) {
      const maxLevel = guide.rows[guide.rows.length - 1].level;
      throw new PlanBlocked(
        next > maxLevel
          ? `${guide.label} est déjà au niveau maximum (${maxLevel}).`
          : `coûts de ${guide.label} niv. ${next} non renseignés dans le guide.`,
      );
    }

    if (next === 1) ensurePrerequisites(id, guide.label);
    const freeOfCapacity = next === 1 && (id === 'hq' || STORAGES.some((s) => s.id === id));
    if (!freeOfCapacity) ensureCapacity(row, `${guide.label} niv. ${next}`);
    steps.push({
      buildingId: id,
      label: guide.label,
      level: next,
      row,
      seconds: parseDuration(row.buildTime),
      isStorage: kind === 'storage',
      isPrerequisite: kind === 'prerequisite',
      explanation: explain(row, guide.label),
    });
    levels.set(id, next);
  };

  const ensurePrerequisites = (id: BuildingId, forLabel: string): void => {
    for (const [dependency, required] of Object.entries(PREREQUISITES[id] ?? {}) as [BuildingId, number][]) {
      while ((levels.get(dependency) ?? 0) < required) {
        build(dependency, (row, label) => `Prérequis de ${forLabel} : ${label} niveau ${required} (passage au niveau ${row.level}).`, 'prerequisite');
      }
    }
  };

  const ensureCapacity = (row: BuildingLevel, forWhat: string): void => {
    for (const storage of STORAGES) {
      for (const res of storage.resources) {
        while (capacityOf(storage) < row[res]) {
          const before = capacityOf(storage);
          build(
            storage.id,
            (depotRow, label) =>
              `${forWhat} demande ${formatNumber(row[res])} de ${RESOURCE_LABELS[res]}, mais le ${label} ne stocke que ` +
              `${formatNumber(before)}. Passage au niveau ${depotRow.level} → capacité ${formatNumber((depotRow as StorageLevel).capacity)}.`,
            'storage',
          );
        }
      }
    }
  };

  let blocker: string | undefined;
  try {
    while ((levels.get(input.buildingId) ?? 0) < input.targetLevel) {
      build(
        input.buildingId,
        (row, label) => `Objectif : ${label} au niveau ${row.level}. Les dépôts peuvent contenir chaque coût de ce niveau.`,
        'target',
      );
    }
  } catch (e) {
    if (!(e instanceof PlanBlocked)) throw e;
    blocker = e.message;
  }

  const totals = { stone: 0, wood: 0, iron: 0, food: 0 };
  for (const step of steps) for (const key of Object.keys(totals) as ResourceKey[]) totals[key] += step.row[key];

  return {
    steps,
    totals,
    totalSeconds: steps.reduce((sum, s) => sum + s.seconds, 0),
    storageSeconds: steps.filter((s) => s.isStorage).reduce((sum, s) => sum + s.seconds, 0),
    blocker,
  };
}
