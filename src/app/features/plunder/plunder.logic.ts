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

const CAPACITY = Object.fromEntries(TROOP_TYPES.map((t) => [t.id, t.capacity])) as Record<TroopId, number>;

/** Pillage par ressource d'une équipe. */
export const plunderCapacity = (team: Troops): number =>
  TROOP_TYPES.reduce((sum, t) => sum + team[t.id] * t.capacity, 0);

export interface PlunderPlan {
  /** Équipe type (vide si aucune troupe ou aucune capacité). */ team: Troops;
  /** Pillage de l'équipe, par ressource. */ capacity: number;
  /** Nombre d'équipes identiques que l'armée peut former. */ teams: number;
  /** Troupes restantes après ces équipes. */ leftover: Troops;
}

const EMPTY: Troops = { genin: 0, chunin: 0, jounin: 0 };

/**
 * Cherche l'équipe dont le pillage (par ressource) est le plus proche de `target` sans le dépasser.
 * À pillage égal : celle qui permet le plus d'équipes identiques avec l'armée, puis la moins nombreuse.
 * Pour chaque nombre de Jounin et de Chunin, on complète avec le maximum de Genin possible.
 */
export function planPlunder(army: Troops, target: number): PlunderPlan {
  let best: { team: Troops; capacity: number; teams: number; units: number } | null = null;
  // Équipes formables pour un type : illimité s'il n'est pas utilisé.
  const copies = (available: number, used: number): number => (used > 0 ? Math.floor(available / used) : Infinity);

  for (let jounin = 0; jounin <= army.jounin; jounin++) {
    const afterJounin = target - jounin * CAPACITY.jounin;
    if (afterJounin < 0) break;
    for (let chunin = 0; chunin <= army.chunin; chunin++) {
      const remaining = afterJounin - chunin * CAPACITY.chunin;
      if (remaining < 0) break;
      const genin = Math.min(army.genin, Math.floor(remaining / CAPACITY.genin));
      const capacity = genin * CAPACITY.genin + chunin * CAPACITY.chunin + jounin * CAPACITY.jounin;
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
  const leftover = Object.fromEntries(TROOP_TYPES.map((t) => [t.id, army[t.id] - team[t.id] * teams])) as Troops;
  return { team, capacity, teams, leftover };
}
