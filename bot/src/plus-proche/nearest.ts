/** « Qui est le plus proche » (repris de l'appli web) : membres du clan classés par distance d'un village. */
import type { MapVillage } from '../game-data.js';
import { distanceKm } from '../retours/travel.js';

export interface NearestMember {
  village: MapVillage;
  /** Distance en km, arrondie au 0,5 comme dans « Retours ». */ distance: number;
}

/** Villages des membres du clan sur la carte (un village par joueur). */
export const clanVillages = (villages: readonly MapVillage[], clan: string): MapVillage[] =>
  villages.filter((v) => !v.neutral && v.clan === clan);

/** Membres du clan, du plus proche au plus éloigné de `target` (le village visé lui-même est exclu). */
export function rankClanMembers(target: MapVillage, members: readonly MapVillage[]): NearestMember[] {
  return members
    .filter((v) => v.name !== target.name)
    .map((village) => ({ village, distance: distanceKm(village, target) }))
    .sort((a, b) => a.distance - b.distance || a.village.kage.localeCompare(b.village.kage, 'fr'));
}
