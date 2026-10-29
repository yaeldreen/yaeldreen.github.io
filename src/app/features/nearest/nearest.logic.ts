import { MapVillage } from '../../core/game-data/map-villages';
import { computeDistance } from '../travel/travel.logic';

export interface NearestMember {
  village: MapVillage;
  /** Distance en km, arrondie au 0,5 comme dans « Retours ». */ distance: number;
}

/** Membres du clan, du plus proche au plus éloigné de `target` (le village visé lui-même est exclu). */
export function rankClanMembers(target: MapVillage, members: readonly MapVillage[]): NearestMember[] {
  return members
    .filter((v) => v.name !== target.name)
    .map((village) => ({ village, distance: computeDistance('coords', null, village, target) }))
    .sort((a, b) => a.distance - b.distance || a.village.kage.localeCompare(b.village.kage, 'fr'));
}
