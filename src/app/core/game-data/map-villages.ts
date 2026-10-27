import { COORDONNEES } from '../../shared/utils/coordonnees';

/** Village de la carte (export du jeu dans shared/utils/coordonnees.ts). */
export interface MapVillage {
  name: string;
  /** Nom du joueur */ kage: string;
  x: number;
  y: number;
  clan: string | null;
  points: number;
  inhabitants: number;
}

export const MAP_VILLAGES: readonly MapVillage[] = COORDONNEES.map(({ name, kage, x, y, clan, points, inhabitants }) => ({
  name,
  kage,
  x,
  y,
  clan: clan?.name ?? null,
  points,
  inhabitants,
}));

const normName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Village dont le nom (ou le kage) correspond, sans tenir compte des accents, de la casse ni des espaces. */
export function findVillage(name: string): MapVillage | null {
  const key = normName(name);
  if (!key) return null;
  return MAP_VILLAGES.find((v) => normName(v.name) === key) ?? MAP_VILLAGES.find((v) => normName(v.kage) === key) ?? null;
}
