/** Temps de déplacement par km en centièmes de seconde. Index 0 = niveau 1. */
const CENTISECONDS_PER_KM = [
  19782, 18741, 17700, 16659, 15618, 14576, 13535, 12494, 11453, 10412,
  9371, 8329, 7288, 6247, 5206, 4165, 3124, 2082, 1041, 500,
] as const;

export interface TravelSpeed {
  level: number;
  centisecondsPerKm: number;
}

export const TRAVEL_SPEEDS: readonly TravelSpeed[] = CENTISECONDS_PER_KM.map((cs, i) => ({
  level: i + 1,
  centisecondsPerKm: cs,
}));
