import { FOOD_DEPOT_LEVELS, RESOURCE_DEPOT_LEVELS, StorageLevel } from '../buildings/buildings.data';
import { TROOP_TYPES, TroopId } from './plunder.data';

export type Troops = Record<TroopId, number>;

const capacityAt = (rows: readonly StorageLevel[], level: number): number => rows.find((r) => r.level === level)?.capacity ?? 0;

export interface StorageCapacity {
  /** Pierre, bois et fer, chacun. */ resources: number;
  food: number;
  /** Pillage maximum par ressource sans rien gâcher (le plus petit des deux dépôts). */ target: number;
}

export function storageCapacity(resourceDepotLevel: number, foodDepotLevel: number): StorageCapacity {
  const resources = capacityAt(RESOURCE_DEPOT_LEVELS, resourceDepotLevel);
  const food = capacityAt(FOOD_DEPOT_LEVELS, foodDepotLevel);
  return { resources, food, target: Math.min(resources, food) };
}

/** Pillage par ressource d'une équipe. */
export const plunderCapacity = (team: Troops): number =>
  TROOP_TYPES.reduce((sum, t) => sum + team[t.id] * t.capacity, 0);

const EMPTY: Troops = { genin: 0, chunin: 0, jounin: 0 };

export interface PlunderGroup {
  team: Troops;
  /** Pillage de l'équipe, par ressource. */ capacity: number;
  /** Nombre d'équipes identiques. */ count: number;
}

export interface PlunderPlan {
  /** Équipes à envoyer, regroupées par composition (la plus grosse d'abord). */ groups: PlunderGroup[];
  /** Nombre total d'équipes. */ teams: number;
  /** Pillage total, par ressource (= toute l'armée). */ total: number;
}

/**
 * Répartit TOUTE l'armée en équipes, chacune sans dépasser `target` (dépôts vides), avec le moins d'équipes possible.
 * On part du minimum théorique (pillage de l'armée / cible, arrondi au-dessus) et on distribue les unités
 * de la plus grosse à la plus petite, chacune dans l'équipe la moins chargée ; si une équipe dépasse, on en ajoute une.
 * Les équipes ont donc des pillages proches les uns des autres ; elles ne remplissent pas forcément les dépôts.
 */
export function planPlunder(army: Troops, target: number): PlunderPlan {
  const total = plunderCapacity(army);
  const units = TROOP_TYPES.reduce((sum, t) => sum + army[t.id], 0);
  if (total === 0 || target <= 0) return { groups: [], teams: 0, total };

  const byBiggest = [...TROOP_TYPES].sort((a, b) => b.capacity - a.capacity);
  let teams: { team: Troops; capacity: number }[] = [];
  for (let n = Math.ceil(total / target); n <= units; n++) {
    teams = Array.from({ length: n }, () => ({ team: { ...EMPTY }, capacity: 0 }));
    for (const type of byBiggest) {
      for (let i = 0; i < army[type.id]; i++) {
        const lightest = teams.reduce((best, t) => (t.capacity < best.capacity ? t : best));
        lightest.team[type.id]++;
        lightest.capacity += type.capacity;
      }
    }
    // Une unité seule plus grosse que la cible ne rentrera jamais : on s'arrête quand chaque équipe a au plus une unité.
    if (teams.every((t) => t.capacity <= target) || n === units) break;
  }

  const groups = new Map<string, PlunderGroup>();
  for (const { team, capacity } of teams) {
    const key = TROOP_TYPES.map((t) => team[t.id]).join('/');
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { team, capacity, count: 1 });
  }
  return {
    groups: [...groups.values()].sort((a, b) => b.capacity - a.capacity),
    teams: teams.length,
    total,
  };
}

export interface FullTeamPlan {
  /** Équipe type (vide si aucune troupe). */ team: Troops;
  /** Pillage de l'équipe, par ressource. */ capacity: number;
  /** Nombre d'équipes identiques que l'armée peut former. */ teams: number;
  /** Troupes restantes après ces équipes. */ leftover: Troops;
}

/**
 * Pillage max : l'équipe dont le pillage est le plus proche de `target` sans le dépasser, envoyée autant de fois que
 * possible ; le reste de l'armée est signalé. À pillage égal : celle qui permet le plus d'équipes, puis la moins nombreuse.
 * Pour chaque nombre de Jounin et de Chunin, on complète avec le maximum de Genin possible.
 */
export function planFullTeams(army: Troops, target: number): FullTeamPlan {
  const capacityOf = (id: TroopId): number => TROOP_TYPES.find((t) => t.id === id)?.capacity ?? 0;
  const [geninCap, chuninCap, jouninCap] = [capacityOf('genin'), capacityOf('chunin'), capacityOf('jounin')];
  // Équipes formables pour un type : illimité s'il n'est pas utilisé.
  const copies = (available: number, used: number): number => (used > 0 ? Math.floor(available / used) : Infinity);
  let best: { team: Troops; capacity: number; teams: number; units: number } | null = null;

  for (let jounin = 0; jounin <= army.jounin; jounin++) {
    const afterJounin = target - jounin * jouninCap;
    if (afterJounin < 0) break;
    for (let chunin = 0; chunin <= army.chunin; chunin++) {
      const remaining = afterJounin - chunin * chuninCap;
      if (remaining < 0) break;
      const genin = Math.min(army.genin, Math.floor(remaining / geninCap));
      const capacity = genin * geninCap + chunin * chuninCap + jounin * jouninCap;
      if (capacity === 0 || (best && capacity < best.capacity)) continue;
      const teams = Math.min(copies(army.genin, genin), copies(army.chunin, chunin), copies(army.jounin, jounin));
      const units = genin + chunin + jounin;
      if (!best || capacity > best.capacity || teams > best.teams || (teams === best.teams && units < best.units)) {
        best = { team: { genin, chunin, jounin }, capacity, teams, units };
      }
    }
  }

  if (!best) return { team: { ...EMPTY }, capacity: 0, teams: 0, leftover: { ...army } };
  const { team, capacity, teams } = best;
  return {
    team,
    capacity,
    teams,
    leftover: { genin: army.genin - team.genin * teams, chunin: army.chunin - team.chunin * teams, jounin: army.jounin - team.jounin * teams },
  };
}
