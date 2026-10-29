import { TRAVEL_SPEEDS } from '../../core/game-data/travel-speeds';
import { findVillage, MapVillage } from '../../core/game-data/map-villages';
import { OWN_CLAN, Player } from '../enemies/clans.data';
import { FormattedDateTime, formatDateTime, formatSpeed } from '../../shared/utils/format';

export type DistanceMode = 'manual' | 'coords' | 'report';

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
  /** true si nos troupes, parties à `counter.nowMs`, arrivent avant le retour de l'ennemi (sans ticket). */
  feasible: boolean;
  /** Avance (> 0) ou retard (< 0) de nos troupes sur leur retour, en ms. */
  marginMs: number;
  /** Idem face à un retour avec ticket. */
  ticketFeasible: boolean;
  ticketMarginMs: number;
}

/** Notre contre-attaque : notre CE, notre trajet jusqu'au village de l'ennemi et l'heure de départ. */
export interface CounterAttack {
  level: number;
  distanceKm: number;
  nowMs: number;
}

/**
 * Villages des membres de notre clan (liste partagée, onglet « Gestion clan »), localisés sur la carte
 * et triés par joueur. Un membre dont le village n'est pas sur la carte est ignoré.
 */
export function clanVillages(players: readonly Player[], villages: readonly MapVillage[]): MapVillage[] {
  return players
    .filter((p) => p.clan === OWN_CLAN)
    .flatMap((p) => {
      const onMap = findVillage(villages, p.village) ?? findVillage(villages, p.name);
      return onMap ? [{ ...onMap, kage: p.name }] : [];
    })
    .sort((a, b) => a.kage.localeCompare(b.kage, 'fr'));
}

/** Le ticket divise le temps de trajet par deux. */
const TICKET_TIME_FACTOR = 0.5;

const num = (value: number | null): number => Number(value) || 0;

/** Distance en km, arrondie au 0,5 le plus proche (les modes « coordonnées » et « rapport » mesurent entre deux points). */
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

/** Durée du trajet en ms pour un niveau de CE (1 à 20). */
export const travelMs = (distanceKm: number, level: number): number =>
  distanceKm * TRAVEL_SPEEDS[Math.min(20, Math.max(1, level)) - 1].centisecondsPerKm * 10;

/** Arrivée de nos troupes au village ennemi si elles partent à `nowMs`. */
export const counterArrivalMs = ({ level, distanceKm, nowMs }: CounterAttack): number => nowMs + travelMs(distanceKm, level);

export function computeReturnRows(distanceKm: number, departureMs: number, counter: CounterAttack): ReturnRow[] {
  const ourArrival = counterArrivalMs(counter);
  return TRAVEL_SPEEDS.map(({ level, centisecondsPerKm }) => {
    const returnAt = departureMs + travelMs(distanceKm, level);
    const ticketReturnAt = departureMs + travelMs(distanceKm, level) * TICKET_TIME_FACTOR;
    return {
      feasible: ourArrival < returnAt,
      marginMs: returnAt - ourArrival,
      ticketFeasible: ourArrival < ticketReturnAt,
      ticketMarginMs: ticketReturnAt - ourArrival,
      level,
      speedPerKm: formatSpeed(centisecondsPerKm),
      arrival: formatDateTime(returnAt),
      ticketArrival: formatDateTime(ticketReturnAt),
    };
  });
}
