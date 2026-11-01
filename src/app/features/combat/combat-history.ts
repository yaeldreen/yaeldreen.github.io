import { readCookie, writeCookie } from '../../shared/utils/cookies';
import { TroopKey } from '../enemies/enemies.model';
import { ArmyLevels } from './combat.logic';

export type LevelKey = keyof ArmyLevels;

export interface SideForm {
  troops: Record<TroopKey, number | null>;
  levels: Record<LevelKey, number | null>;
  hospitalTicket: boolean;
  combatTicket: boolean;
}

export interface HistorySide {
  player: string;
  form: SideForm;
}

export interface HistoryEntry {
  at: number;
  attacker: HistorySide;
  defender: HistorySide;
}

export const HISTORY_SIZE = 5;
const COOKIE = 'combat.history';

const TROOP_ORDER: readonly TroopKey[] = ['genin', 'chuunin', 'jounin'];
const LEVEL_ORDER: readonly LevelKey[] = ['training', 'academy', 'chunnin', 'jounin', 'hospital', 'wall'];

/** Camp compacté en tableau pour tenir dans un cookie (4 Ko) : [joueur, troupes, niveaux, ticket hôpital, ticket combat]. */
export type PackedSide = [string, (number | null)[], (number | null)[], 0 | 1, 0 | 1];
type PackedEntry = [number, PackedSide, PackedSide];

export const packSide = ({ player, form }: HistorySide): PackedSide => [
  player,
  TROOP_ORDER.map((k) => form.troops[k]),
  LEVEL_ORDER.map((k) => form.levels[k]),
  form.hospitalTicket ? 1 : 0,
  form.combatTicket ? 1 : 0,
];

export const unpackSide = ([player, troops, levels, hospitalTicket, combatTicket]: PackedSide): HistorySide => ({
  player,
  form: {
    troops: Object.fromEntries(TROOP_ORDER.map((k, i) => [k, troops[i] ?? null])) as SideForm['troops'],
    levels: Object.fromEntries(LEVEL_ORDER.map((k, i) => [k, levels[i] ?? null])) as SideForm['levels'],
    hospitalTicket: hospitalTicket === 1,
    combatTicket: combatTicket === 1,
  },
});

export const encodeHistory = (entries: readonly HistoryEntry[]): string =>
  JSON.stringify(entries.map((e): PackedEntry => [e.at, packSide(e.attacker), packSide(e.defender)]));

/** Historique illisible (cookie abîmé, ancien format) : on repart d'une liste vide. */
export function decodeHistory(text: string | null): HistoryEntry[] {
  if (!text) return [];
  try {
    const raw = JSON.parse(text) as PackedEntry[];
    return raw.slice(0, HISTORY_SIZE).map(([at, a, d]) => ({ at, attacker: unpackSide(a), defender: unpackSide(d) }));
  } catch {
    return [];
  }
}

/** Ajoute en tête, sans doublon de la dernière simulation, et garde les 5 plus récentes. */
export function pushHistory(entries: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const same = (x: HistoryEntry) => encodeHistory([{ ...x, at: 0 }]) === encodeHistory([{ ...entry, at: 0 }]);
  return [entry, ...entries.filter((e) => !same(e))].slice(0, HISTORY_SIZE);
}

export const loadHistory = (): HistoryEntry[] => decodeHistory(readCookie(COOKIE));
export const saveHistory = (entries: readonly HistoryEntry[]): void => writeCookie(COOKIE, encodeHistory(entries));
