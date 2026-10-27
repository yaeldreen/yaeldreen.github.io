import {
  ACADEMY_LEVELS,
  BuildingLevel,
  CHUNNIN_LEVELS,
  FOOD_DEPOT_LEVELS,
  HIGH_COUNCIL_LEVELS,
  HOSPITAL_LEVELS,
  HQ_LEVELS,
  JOUNIN_LEVELS,
  MINE_LEVELS,
  RAPTOR_LEVELS,
  RESERVE_LEVELS,
  RESOURCE_DEPOT_LEVELS,
  TRAINING_CENTER_LEVELS,
  WALL_LEVELS,
  WATCHTOWER_LEVELS,
} from './buildings.data';

export type EstimatedBuilding =
  | 'hq'
  | 'training'
  | 'academy'
  | 'chunnin'
  | 'jounin'
  | 'watchtower'
  | 'hospital'
  | 'wall'
  | 'commerce'
  | 'resourceDepot'
  | 'foodDepot'
  | 'reserve'
  | 'raptor'
  | 'highCouncil'
  | 'mineStone'
  | 'mineWood'
  | 'mineIron'
  | 'mineFood';

export type EstimatedLevels = Record<EstimatedBuilding, number>;

interface Rule {
  rows: readonly BuildingLevel[];
  /** Niveaux requis avant le niveau 1 (arbre des constructions). */ requires?: Partial<Record<EstimatedBuilding, number>>;
  /** Niveau maximum habituel des joueurs. */ cap?: number;
  /** < 1 : construit en priorité ; > 1 : repoussé. */ weight?: number;
}

const mine = (): Rule => ({ rows: MINE_LEVELS.filter((r) => r.level > 0), cap: 3 });

// Profil de joueur type, calé avec le clan : centres d'entraînement en priorité (8 max à ce stade),
// mines au niveau 3, Réserve et Haut Conseil au niveau 1, pas d'Élevage de rapaces.
const RULES: Record<EstimatedBuilding, Rule> = {
  hq: { rows: HQ_LEVELS, weight: 0.4 },
  training: { rows: TRAINING_CENTER_LEVELS, requires: { hq: 3 }, weight: 0.8 },
  academy: { rows: ACADEMY_LEVELS, requires: { hq: 3, training: 1 }, cap: 8, weight: 0.3 },
  chunnin: { rows: CHUNNIN_LEVELS, requires: { hq: 6, academy: 5 }, cap: 8, weight: 0.3 },
  jounin: { rows: JOUNIN_LEVELS, requires: { hq: 12, chunnin: 5 }, cap: 8, weight: 0.3 },
  watchtower: { rows: WATCHTOWER_LEVELS, requires: { hq: 15, jounin: 10, wall: 8 }, weight: 1.3 },
  hospital: { rows: HOSPITAL_LEVELS, requires: { academy: 1 } },
  wall: { rows: WALL_LEVELS, requires: { hq: 1 } },
  // Coûts du Commerce incomplets : même grille que l'Hôpital.
  commerce: { rows: HOSPITAL_LEVELS, requires: { hq: 5 } },
  resourceDepot: { rows: RESOURCE_DEPOT_LEVELS, requires: { hq: 1 } },
  foodDepot: { rows: FOOD_DEPOT_LEVELS, requires: { hq: 1 } },
  reserve: { rows: RESERVE_LEVELS, requires: { hq: 1 }, cap: 1 },
  raptor: { rows: RAPTOR_LEVELS, requires: { hq: 2 }, cap: 0 },
  highCouncil: { rows: HIGH_COUNCIL_LEVELS, requires: { hq: 3 }, cap: 1 },
  mineStone: mine(),
  mineWood: mine(),
  mineIron: mine(),
  mineFood: mine(),
};

const BUILDINGS = Object.keys(RULES) as EstimatedBuilding[];
const totalCost = (r: BuildingLevel): number => r.stone + r.wood + r.iron + r.food;

const cache = new Map<number, EstimatedLevels>();

/**
 * Niveaux probables d'un village d'après son nombre d'habitants : chaque niveau construit consomme des habitants.
 * On construit niveau par niveau le moins cher (pondéré par les priorités) parmi ceux dont les prérequis
 * sont remplis, jusqu'à épuiser les habitants. Estimation à ±2 niveaux environ.
 */
export function estimateLevels(inhabitants: number): EstimatedLevels {
  const cached = cache.get(inhabitants);
  if (cached) return cached;

  const levels = Object.fromEntries(BUILDINGS.map((b) => [b, 0])) as EstimatedLevels;
  let used = 0;
  for (;;) {
    let best: { building: EstimatedBuilding; score: number; population: number } | null = null;
    for (const building of BUILDINGS) {
      const { rows, requires = {}, cap = Infinity, weight = 1 } = RULES[building];
      if (levels[building] >= Math.min(rows.length, cap)) continue;
      if (Object.entries(requires).some(([b, lvl]) => levels[b as EstimatedBuilding] < lvl!)) continue;
      const next = rows[levels[building]];
      const score = totalCost(next) * weight;
      if (!best || score < best.score) best = { building, score, population: next.population };
    }
    if (!best || used + best.population > inhabitants) break;
    levels[best.building]++;
    used += best.population;
  }

  cache.set(inhabitants, levels);
  return levels;
}
