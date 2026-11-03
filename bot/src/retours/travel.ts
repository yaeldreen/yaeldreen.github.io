/**
 * Temps de trajet et heures de retour (repris de l'onglet « Retours » de l'appli web).
 * Vitesses : document gameData/travel (base 208 s/km, temps par km du jeu par niveau de CE).
 */

export interface TravelData {
  baseSecondsPerKm: number;
  levels: { level: number; centisecondsPerKm: number }[];
}

export interface Point {
  x: number;
  y: number;
}

/** Le CE 20 ne suit pas la règle des 5 % (il donnerait 0) : 5 s par km dans le jeu. */
const LEVEL_20_SECONDS_PER_KM = 5;

const clampLevel = (level: number): number => Math.min(20, Math.max(1, Math.floor(level)));

/** Distance en km entre deux villages, arrondie au 0,5 le plus proche. */
export const distanceKm = (a: Point, b: Point): number => Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 2) / 2;

/** Temps par km sans ticket, sans arrondi : 208 s moins 5 % par niveau de CE (CE 11 : 208 × 0,45 = 93,6 s). */
export function secondsPerKm(data: TravelData, level: number): number {
  const ce = clampLevel(level);
  return ce === 20 ? LEVEL_20_SECONDS_PER_KM : (data.baseSecondsPerKm * (20 - ce)) / 20;
}

/** Temps par km avec le ticket vitesse : temps du jeu arrondi à la seconde, divisé par deux (CE 12 : 41,5 s). */
export function ticketSecondsPerKm(data: TravelData, level: number): number {
  const ce = clampLevel(level);
  const row = data.levels.find((l) => l.level === ce);
  return Math.round((row?.centisecondsPerKm ?? 0) / 100) / 2;
}

/**
 * Durée du trajet en ms.
 * Sans ticket : temps par km × distance, arrondi à la seconde (CE 11 sur 38,5 km → 3 604 s).
 * Avec ticket : temps par km avec ticket × distance, arrondi à la seconde supérieure (CE 4 sur 7,5 km → 627 s).
 */
export function travelMs(data: TravelData, distance: number, level: number, ticket = false): number {
  const seconds = ticket ? Math.ceil(ticketSecondsPerKm(data, level) * distance - 1e-9) : Math.round(secondsPerKm(data, level) * distance);
  return seconds * 1000;
}

/** Notre contre-attaque : notre CE, notre trajet jusqu'au village de l'assaillant et l'heure de départ. */
export interface CounterAttack {
  level: number;
  distanceKm: number;
  nowMs: number;
}

export interface ReturnRow {
  level: number;
  returnAt: number;
  ticketReturnAt: number;
  /** Avance (> 0) ou retard (< 0) de notre contre-attaque sur leur retour, en ms ; null sans CE renseigné. */
  marginMs: number | null;
  ticketMarginMs: number | null;
}

/** Heure de retour des troupes ennemies pour chaque niveau de CE, et si notre contre-attaque arrive avant. */
export function returnRows(data: TravelData, distance: number, attackedAtMs: number, counter: CounterAttack | null): ReturnRow[] {
  const ourArrival = counter ? counter.nowMs + travelMs(data, counter.distanceKm, counter.level) : null;
  return Array.from({ length: 20 }, (_, i) => {
    const level = i + 1;
    const returnAt = attackedAtMs + travelMs(data, distance, level);
    const ticketReturnAt = attackedAtMs + travelMs(data, distance, level, true);
    return {
      level,
      returnAt,
      ticketReturnAt,
      marginMs: ourArrival === null ? null : returnAt - ourArrival,
      ticketMarginMs: ourArrival === null ? null : ticketReturnAt - ourArrival,
    };
  });
}
