import { RESOURCES, ResourceKey } from '../../core/game-data/resources';
import { formatNumber } from '../../shared/utils/format';
import { BuildingLevel, FOOD_DEPOT_LEVELS, RESOURCE_DEPOT_LEVELS, StorageLevel } from '../buildings/buildings.data';
import { BUILDING_GUIDES, BuildingGuide, BuildingId } from '../buildings/buildings.guides';

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
}

export interface PlanStep {
  buildingId: BuildingId;
  label: string;
  /** Niveau atteint à la fin de l'étape */ level: number;
  row: BuildingLevel;
  seconds: number;
  /** true = amélioration de dépôt imposée par la capacité */ isStorage: boolean;
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
 */
export function simulateUpgrades(input: SimulationInput): SimulationPlan {
  const levels = new Map<BuildingId, number>([
    ['resourceDepot', input.resourceDepotLevel],
    ['foodDepot', input.foodDepotLevel],
    [input.buildingId, input.currentLevel],
  ]);
  const steps: PlanStep[] = [];

  const capacityOf = (storage: Storage): number =>
    storage.rows.find((r) => r.level === levels.get(storage.id))?.capacity ?? 0;

  const build = (id: BuildingId, explain: (row: BuildingLevel, label: string) => string, isStorage: boolean): void => {
    const guide = guideOf(id);
    const next = levels.get(id)! + 1;
    const row = guide.rows.find((r) => r.level === next);
    if (!row) throw new PlanBlocked(`${guide.label} est déjà au niveau maximum (${next - 1}).`);

    ensureCapacity(row, `${guide.label} niv. ${next}`);
    steps.push({ buildingId: id, label: guide.label, level: next, row, seconds: parseDuration(row.buildTime), isStorage, explanation: explain(row, guide.label) });
    levels.set(id, next);
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
            true,
          );
        }
      }
    }
  };

  let blocker: string | undefined;
  try {
    while (levels.get(input.buildingId)! < input.targetLevel) {
      build(
        input.buildingId,
        (row, label) => `Objectif : ${label} au niveau ${row.level}. Les dépôts peuvent contenir chaque coût de ce niveau.`,
        false,
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
