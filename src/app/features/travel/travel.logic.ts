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
  /** Temps par km avec le ticket vitesse ("41,5 s / km"). */ ticketSpeedPerKm: string;
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
 * Villages des membres de notre clan (liste partagée, mise à jour par « MAJ joueurs »), localisés sur la carte
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

/** Secondes par km sans Centre d'entraînement ; chaque niveau de CE retire 5 % (CE 11 : 208 × 0,45). */
const BASE_SECONDS_PER_KM = 208;
/** Le CE 20 ne suit pas la règle (il donnerait 0) : 5 s par km dans le jeu. */
const LEVEL_20_SECONDS_PER_KM = 5;

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

/** Temps par km du jeu, sans arrondi : 208 s moins le bonus du CE (CE 11 : −55 %, soit 208 × 0,45 = 93,6 s). */
export function secondsPerKm(level: number): number {
  const ce = Math.min(20, Math.max(1, level));
  return ce === 20 ? LEVEL_20_SECONDS_PER_KM : (BASE_SECONDS_PER_KM * (20 - ce)) / 20;
}

/**
 * Temps par km avec le ticket vitesse : temps par km du jeu (tableau du CE) arrondi à la seconde, divisé par deux.
 * CE 12 : 83,29 → 83 → 41,5 s ; CE 13 : 72,88 → 73 → 36,5 s ; CE 4 : 166,59 → 167 → 83,5 s.
 */
export const ticketSecondsPerKm = (level: number): number =>
  Math.round(TRAVEL_SPEEDS[Math.min(20, Math.max(1, level)) - 1].centisecondsPerKm / 100) / 2;

/**
 * Durée du trajet en ms pour un niveau de CE (1 à 20).
 * Sans ticket : temps par km × distance, arrondi à la seconde (CE 11 sur 38,5 km : 93,6 × 38,5 → 3 604 s).
 * Avec ticket : temps par km avec ticket × distance, arrondi à la seconde supérieure
 * (CE 4 sur 7,5 km : 83,5 × 7,5 = 626,25 → 627 s = 10:27 ; CE 11 sur 38,5 km : 47 × 38,5 → 1 810 s = 30:10).
 */
export function travelMs(distanceKm: number, level: number, ticket = false): number {
  const seconds = ticket
    ? Math.ceil(ticketSecondsPerKm(level) * distanceKm - 1e-9)
    : Math.round(secondsPerKm(level) * distanceKm);
  return seconds * 1000;
}

export const counterArrivalMs = ({ level, distanceKm, nowMs }: CounterAttack): number => nowMs + travelMs(distanceKm, level);

export function computeReturnRows(distanceKm: number, departureMs: number, counter: CounterAttack): ReturnRow[] {
  const ourArrival = counterArrivalMs(counter);
  return TRAVEL_SPEEDS.map(({ level }) => {
    const returnAt = departureMs + travelMs(distanceKm, level);
    const ticketReturnAt = departureMs + travelMs(distanceKm, level, true);
    return {
      feasible: ourArrival < returnAt,
      marginMs: returnAt - ourArrival,
      ticketFeasible: ourArrival < ticketReturnAt,
      ticketMarginMs: ticketReturnAt - ourArrival,
      level,
      speedPerKm: formatSpeed(secondsPerKm(level) * 100),
      ticketSpeedPerKm: `${String(ticketSecondsPerKm(level)).replace('.', ',')} s/km`,
      arrival: formatDateTime(returnAt),
      ticketArrival: formatDateTime(ticketReturnAt),
    };
  });
}
