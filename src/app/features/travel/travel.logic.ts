import { TRAVEL_SPEEDS } from '../../core/game-data/travel-speeds';
import { FormattedDateTime, formatDateTime, formatSpeed } from '../../shared/utils/format';

export type DistanceMode = 'manual' | 'coords';

/** `null` = champ vidé par l'utilisateur, traité comme 0. */
export interface Coordinate {
  x: number | null;
  y: number | null;
}

export interface ReturnRow {
  level: number;
  speedPerKm: string;
  arrival: FormattedDateTime;
  ticketArrival: FormattedDateTime;
}

/** Le ticket divise le temps de trajet par deux. */
const TICKET_TIME_FACTOR = 0.5;

const num = (value: number | null): number => Number(value) || 0;

/** Distance en km, arrondie au 0,5 le plus proche. */
export function computeDistance(
  mode: DistanceMode,
  manualKm: number | null,
  from: Coordinate,
  to: Coordinate,
): number {
  const raw =
    mode === 'manual' ? num(manualKm) : Math.hypot(num(to.x) - num(from.x), num(to.y) - num(from.y));
  return Math.round(raw * 2) / 2;
}

export function computeReturnRows(distanceKm: number, departureMs: number): ReturnRow[] {
  return TRAVEL_SPEEDS.map(({ level, centisecondsPerKm }) => {
    const travelMs = distanceKm * centisecondsPerKm * 10;
    return {
      level,
      speedPerKm: formatSpeed(centisecondsPerKm),
      arrival: formatDateTime(departureMs + travelMs),
      ticketArrival: formatDateTime(departureMs + travelMs * TICKET_TIME_FACTOR),
    };
  });
}
