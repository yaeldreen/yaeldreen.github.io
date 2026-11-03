/**
 * Simulation de construction (repris de l'onglet « Simu constru » de l'appli web) :
 * enchaîne les niveaux d'un bâtiment en montant d'abord les dépôts quand un coût dépasse leur capacité.
 */
import type { Buildings, LevelRow } from '../build-guide/buildings.js';
import { num } from '../shared/format.js';

type ResourceKey = 'stone' | 'wood' | 'iron' | 'food';
type StorageId = 'resourceDepot' | 'foodDepot';

const RESOURCE_KEYS: readonly ResourceKey[] = ['stone', 'wood', 'iron', 'food'];
const RESOURCE_LABELS: Record<ResourceKey, string> = { stone: 'pierre', wood: 'bois', iron: 'fer', food: 'nourriture' };

/** Ressources dont le coût unitaire doit tenir dans la capacité de chaque dépôt. */
const STORAGES: readonly { id: StorageId; resources: readonly ResourceKey[] }[] = [
  { id: 'resourceDepot', resources: ['stone', 'wood', 'iron'] },
  { id: 'foodDepot', resources: ['food'] },
];

const UNIT_SECONDS: Record<string, number> = { j: 86400, h: 3600, min: 60, secondes: 1, sec: 1, s: 1 };

/** Lit les temps de construction : "0:00:03:20" (j:h:min:s), "1 j 4 h 50 min", "1min 47s", "55 sec"… */
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
  buildingId: string;
  currentLevel: number;
  targetLevel: number;
  resourceDepotLevel: number;
  foodDepotLevel: number;
}

export interface PlanStep {
  buildingId: string;
  label: string;
  /** Niveau atteint à la fin de l'étape */ level: number;
  row: LevelRow;
  seconds: number;
  /** true = amélioration de dépôt imposée par la capacité */ isStorage: boolean;
  explanation: string;
}

export interface SimulationPlan {
  steps: PlanStep[];
  totalSeconds: number;
  totals: Record<ResourceKey, number>;
  storageSeconds: number;
  /** Raison de l'arrêt si le plan ne peut pas aller au bout (niveau maximum, niveau non renseigné). */
  blocker?: string;
}

class PlanBlocked extends Error {}

const cost = (row: LevelRow, key: ResourceKey): number => Number(row[key]) || 0;

/**
 * Le niveau N d'un tableau donne le coût pour atteindre le niveau N.
 * Avant chaque construction, chaque coût unitaire doit tenir dans la capacité du dépôt concerné
 * (pierre/bois/fer → Dépôt de ressources, nourriture → Dépôt de nourriture) ; sinon le dépôt
 * est amélioré d'abord, lui-même sous la même contrainte. Les constructions sont enchaînées
 * une par une, le temps total est donc la somme des temps.
 */
export function simulateUpgrades(buildings: Buildings, input: SimulationInput): SimulationPlan {
  const levels = new Map<string, number>([
    ['resourceDepot', input.resourceDepotLevel],
    ['foodDepot', input.foodDepotLevel],
    [input.buildingId, input.currentLevel],
  ]);
  const steps: PlanStep[] = [];

  const capacityOf = (id: StorageId): number => Number(buildings[id]?.levels.find((r) => r.level === levels.get(id))?.['capacity']) || 0;

  const build = (id: string, explain: (row: LevelRow, label: string) => string, isStorage: boolean): void => {
    const building = buildings[id];
    const next = levels.get(id)! + 1;
    const row = building.levels.find((r) => r.level === next);
    if (!row) {
      const maxLevel = Math.max(...building.levels.map((r) => r.level));
      throw new PlanBlocked(
        next > maxLevel
          ? `${building.name} est déjà au niveau maximum (${maxLevel}).`
          : `Coûts de ${building.name} niv. ${next} non renseignés (ajoutez-les avec !ajouterNiveau dans #build-guide).`,
      );
    }
    ensureCapacity(row, `${building.name} niv. ${next}`);
    steps.push({ buildingId: id, label: building.name, level: next, row, seconds: parseDuration(String(row['buildTime'])), isStorage, explanation: explain(row, building.name) });
    levels.set(id, next);
  };

  const ensureCapacity = (row: LevelRow, forWhat: string): void => {
    for (const storage of STORAGES) {
      for (const res of storage.resources) {
        while (capacityOf(storage.id) < cost(row, res)) {
          const before = capacityOf(storage.id);
          build(
            storage.id,
            (depotRow) =>
              `Pour ${forWhat} : ${num(cost(row, res))} ${RESOURCE_LABELS[res]}, stock max ${num(before)} → ${num(Number(depotRow['capacity']))}`,
            true,
          );
        }
      }
    }
  };

  let blocker: string | undefined;
  try {
    while (levels.get(input.buildingId)! < input.targetLevel) {
      build(input.buildingId, (row, label) => `${label} au niveau ${row.level}.`, false);
    }
  } catch (e) {
    if (!(e instanceof PlanBlocked)) throw e;
    blocker = e.message;
  }

  const totals = { stone: 0, wood: 0, iron: 0, food: 0 };
  for (const step of steps) for (const key of RESOURCE_KEYS) totals[key] += cost(step.row, key);

  return {
    steps,
    totals,
    totalSeconds: steps.reduce((sum, s) => sum + s.seconds, 0),
    storageSeconds: steps.filter((s) => s.isStorage).reduce((sum, s) => sum + s.seconds, 0),
    blocker,
  };
}
