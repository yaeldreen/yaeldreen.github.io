/**
 * Pillages (repris de l'onglet de l'appli web) : toute l'armée répartie en équipes équilibrées, chacune sans dépasser
 * le plus petit dépôt (dépôts vides), avec le moins d'équipes possible. Capacités lues dans Firestore.
 */
import type { Buildings } from '../build-guide/buildings.js';
import type { TroopCounts, TroopKey } from '../combat/combat.js';

const KEYS: readonly TroopKey[] = ['genin', 'chuunin', 'jounin'];

/** Document gameData/troops : capacité de pillage par unité (l'id « chunin » correspond à nos Chuunin). */
export interface TroopsData {
  list: { id: string; label: string; capacity: number }[];
}

export function plunderCapacities(data: TroopsData): TroopCounts {
  const of = (id: string) => data.list.find((t) => t.id === id)?.capacity ?? 0;
  return { genin: of('genin'), chuunin: of('chunin') || of('chuunin'), jounin: of('jounin') };
}

export interface StorageCapacity {
  /** Pierre, bois et fer, chacun. */ resources: number;
  food: number;
  /** Pillage maximum par ressource sans rien gâcher (le plus petit des deux dépôts). */ target: number;
}

export function storageCapacity(buildings: Buildings, resourceDepotLevel: number, foodDepotLevel: number): StorageCapacity {
  const capacity = (id: string, level: number) => Number(buildings[id]?.levels.find((l) => l.level === level)?.['capacity']) || 0;
  const resources = capacity('resourceDepot', resourceDepotLevel);
  const food = capacity('foodDepot', foodDepotLevel);
  return { resources, food, target: Math.min(resources, food) };
}

/** Pillage par ressource d'une équipe. */
export const plunderOf = (team: TroopCounts, caps: TroopCounts): number => KEYS.reduce((sum, k) => sum + team[k] * caps[k], 0);

export interface PlunderGroup {
  team: TroopCounts;
  /** Pillage de l'équipe, par ressource. */ capacity: number;
  /** Nombre d'équipes identiques. */ count: number;
}

export interface PlunderPlan {
  /** Équipes à envoyer, regroupées par composition (la plus grosse d'abord). */ groups: PlunderGroup[];
  teams: number;
  /** Pillage total, par ressource (= toute l'armée). */ total: number;
}

/**
 * On part du minimum théorique (pillage de l'armée / cible, arrondi au-dessus) et on distribue les unités de la plus
 * grosse à la plus petite, chacune dans l'équipe la moins chargée ; si une équipe dépasse, on en ajoute une.
 */
export function planPlunder(army: TroopCounts, target: number, caps: TroopCounts): PlunderPlan {
  const total = plunderOf(army, caps);
  const units = KEYS.reduce((sum, k) => sum + army[k], 0);
  if (total === 0 || target <= 0) return { groups: [], teams: 0, total };

  const byBiggest = [...KEYS].sort((a, b) => caps[b] - caps[a]);
  let teams: { team: TroopCounts; capacity: number }[] = [];
  for (let n = Math.ceil(total / target); n <= units; n++) {
    teams = Array.from({ length: n }, () => ({ team: { genin: 0, chuunin: 0, jounin: 0 }, capacity: 0 }));
    for (const key of byBiggest) {
      for (let i = 0; i < army[key]; i++) {
        const lightest = teams.reduce((best, t) => (t.capacity < best.capacity ? t : best));
        lightest.team[key]++;
        lightest.capacity += caps[key];
      }
    }
    // Une unité seule plus grosse que la cible ne rentrera jamais : on s'arrête quand chaque équipe a au plus une unité.
    if (teams.every((t) => t.capacity <= target) || n === units) break;
  }

  const groups = new Map<string, PlunderGroup>();
  for (const { team, capacity } of teams) {
    const key = KEYS.map((k) => team[k]).join('/');
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { team, capacity, count: 1 });
  }
  return { groups: [...groups.values()].sort((a, b) => b.capacity - a.capacity), teams: teams.length, total };
}

export interface FullTeamPlan {
  /** Équipe type (vide si aucune troupe ou aucune capacité). */ team: TroopCounts;
  /** Pillage de l'équipe, par ressource. */ capacity: number;
  /** Nombre d'équipes identiques que l'armée peut former. */ teams: number;
  /** Troupes restantes après ces équipes. */ leftover: TroopCounts;
}

/**
 * Pillage « plein » (ancien mode de l'appli) : l'équipe dont le pillage est le plus proche de `target` sans le
 * dépasser, envoyée autant de fois que possible ; le reste de l'armée est signalé.
 * À pillage égal : celle qui permet le plus d'équipes, puis la moins nombreuse.
 * Pour chaque nombre de Jounin et de Chuunin, on complète avec le maximum de Genin possible.
 */
export function planFullTeams(army: TroopCounts, target: number, caps: TroopCounts): FullTeamPlan {
  let best: { team: TroopCounts; capacity: number; teams: number; units: number } | null = null;
  // Équipes formables pour un type : illimité s'il n'est pas utilisé.
  const copies = (available: number, used: number): number => (used > 0 ? Math.floor(available / used) : Infinity);

  for (let jounin = 0; jounin <= army.jounin; jounin++) {
    const afterJounin = target - jounin * caps.jounin;
    if (afterJounin < 0) break;
    for (let chuunin = 0; chuunin <= army.chuunin; chuunin++) {
      const remaining = afterJounin - chuunin * caps.chuunin;
      if (remaining < 0) break;
      const genin = Math.min(army.genin, caps.genin > 0 ? Math.floor(remaining / caps.genin) : 0);
      const capacity = genin * caps.genin + chuunin * caps.chuunin + jounin * caps.jounin;
      if (capacity === 0 || (best && capacity < best.capacity)) continue;
      const teams = Math.min(copies(army.genin, genin), copies(army.chuunin, chuunin), copies(army.jounin, jounin));
      const units = genin + chuunin + jounin;
      if (!best || capacity > best.capacity || teams > best.teams || (teams === best.teams && units < best.units)) {
        best = { team: { genin, chuunin, jounin }, capacity, teams, units };
      }
    }
  }

  if (!best) return { team: { genin: 0, chuunin: 0, jounin: 0 }, capacity: 0, teams: 0, leftover: { ...army } };
  const { team, capacity, teams } = best;
  const leftover = Object.fromEntries(KEYS.map((k) => [k, army[k] - team[k] * teams])) as TroopCounts;
  return { team, capacity, teams, leftover };
}
