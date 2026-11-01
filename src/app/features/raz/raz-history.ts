import { readCookie, writeCookie } from '../../shared/utils/cookies';
import { HistorySide, PackedSide, packSide, unpackSide } from '../combat/combat-history';

export interface RazEntry {
  at: number;
  defender: HistorySide;
  attackers: HistorySide[];
  healedReturn: boolean;
}

export const RAZ_HISTORY_SIZE = 2;
const COOKIE = 'raz.history';
/** Un cookie est limité à 4 Ko : on garde de la marge pour le nom et les attributs. */
const MAX_COOKIE_CHARS = 3800;

type PackedRaz = [number, PackedSide, PackedSide[], 0 | 1];

export const encodeRazHistory = (entries: readonly RazEntry[]): string =>
  JSON.stringify(entries.map((e): PackedRaz => [e.at, packSide(e.defender), e.attackers.map(packSide), e.healedReturn ? 1 : 0]));

/** Historique illisible (cookie abîmé, ancien format) : on repart d'une liste vide. */
export function decodeRazHistory(text: string | null): RazEntry[] {
  if (!text) return [];
  try {
    return (JSON.parse(text) as PackedRaz[]).slice(0, RAZ_HISTORY_SIZE).map(([at, defender, attackers, healed]) => ({
      at,
      defender: unpackSide(defender),
      attackers: attackers.map(unpackSide),
      healedReturn: healed === 1,
    }));
  } catch {
    return [];
  }
}

/**
 * Ajoute en tête, sans doublon, et garde les 2 plus récents. Si le cookie déborde (beaucoup d'attaquants),
 * le plus ancien est abandonné ; un raz trop gros à lui seul n'est pas retenu.
 */
export function pushRazHistory(entries: readonly RazEntry[], entry: RazEntry): RazEntry[] {
  const key = (e: RazEntry) => encodeRazHistory([{ ...e, at: 0 }]);
  // Le même raz relancé (depuis l'historique par exemple) remonte en tête au lieu d'apparaître deux fois.
  const list = [entry, ...entries.filter((e) => key(e) !== key(entry))].slice(0, RAZ_HISTORY_SIZE);
  while (list.length && encodeURIComponent(encodeRazHistory(list)).length > MAX_COOKIE_CHARS) list.pop();
  return list;
}

export const loadRazHistory = (): RazEntry[] => decodeRazHistory(readCookie(COOKIE));
export const saveRazHistory = (entries: readonly RazEntry[]): void => writeCookie(COOKIE, encodeRazHistory(entries));
