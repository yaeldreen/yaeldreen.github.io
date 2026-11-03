/**
 * Calcul seconde (repris de l'appli web) : avec la production des champs, retrouver depuis quand une ressource
 * produit, d'après le stock relevé à une heure précise. Table de production : gameData/buildings (« mine »).
 */
import type { Buildings } from '../build-guide/buildings.js';

export type ResourceKey = 'stone' | 'wood' | 'iron' | 'food';
export const RESOURCES: readonly { key: ResourceKey; label: string; emoji: string }[] = [
  { key: 'stone', label: 'Pierre', emoji: '🪨' },
  { key: 'wood', label: 'Bois', emoji: '🪵' },
  { key: 'iron', label: 'Fer', emoji: '⚙️' },
  { key: 'food', label: 'Nourriture', emoji: '🍖' },
];

/** Nombre de champs par ressource (gameData/production) : 2 pierre, 2 bois, 2 fer, 3 nourriture. */
export type FieldCounts = Record<ResourceKey, number>;
/** Niveaux des champs de chaque ressource. */
export type FieldLevels = Record<ResourceKey, number[]>;

/** Production horaire d'un champ (niveau 0 à 20, même table pour toutes les ressources). */
export const fieldProduction = (buildings: Buildings, level: number): number =>
  Number(buildings['mine']?.levels.find((r) => r.level === level)?.['productionPerHour']) || 0;

/** `!mesChamps 5 5 4 4 6 6 3 3 3` → niveaux par ressource, dans l'ordre pierre, bois, fer, nourriture. */
export function parseFieldLevels(args: readonly string[], counts: FieldCounts): FieldLevels | { error: string } {
  const expected = RESOURCES.reduce((n, r) => n + counts[r.key], 0);
  const order = RESOURCES.map((r) => `${counts[r.key]} ${r.label.toLowerCase()}`).join(', ');
  if (args.length !== expected) return { error: `Il faut ${expected} niveaux de champs, dans l'ordre : ${order}.` };
  const values = args.map(Number);
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 20)) return { error: 'Chaque niveau de champ va de 0 à 20.' };
  const levels = {} as FieldLevels;
  let i = 0;
  for (const r of RESOURCES) {
    levels[r.key] = values.slice(i, i + counts[r.key]);
    i += counts[r.key];
  }
  return levels;
}

export interface ResourceTiming {
  /** Somme des champs de la ressource. */ perHour: number;
  /** Secondes écoulées depuis 0 ressource (null sans production ou sans quantité). */ elapsedSeconds: number | null;
  /** Heure (ms) à laquelle le stock était à 0. */ zeroAt: number | null;
}

/** Production continue : `amount` ressources à `atMs` ⇒ le stock était vide `amount / production` heures plus tôt. */
export function timeSinceEmpty(buildings: Buildings, fieldLevels: readonly number[], amount: number | null, atMs: number): ResourceTiming {
  const perHour = fieldLevels.reduce((sum, level) => sum + fieldProduction(buildings, level), 0);
  if (amount === null || perHour <= 0) return { perHour, elapsedSeconds: null, zeroAt: null };
  const elapsedSeconds = Math.round((amount * 3600) / perHour);
  return { perHour, elapsedSeconds, zeroAt: atMs - elapsedSeconds * 1000 };
}
