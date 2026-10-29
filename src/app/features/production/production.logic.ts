import { ResourceKey } from '../../core/game-data/resources';
import { MINE_LEVELS } from '../buildings/buildings.data';

/** Nombre de champs par ressource. */
export const FIELD_COUNTS: Record<ResourceKey, number> = { stone: 2, wood: 2, iron: 2, food: 3 };

export const FIELD_MAX_LEVEL = 20;

/** Production horaire d'un champ (niveau 0 à 20, même table pour toutes les ressources). */
export const fieldProduction = (level: number): number => MINE_LEVELS.find((r) => r.level === level)?.productionPerHour ?? 0;

export interface ResourceTiming {
  /** Somme des champs de la ressource. */ perHour: number;
  /** Secondes écoulées depuis 0 ressource (null sans production ou sans quantité saisie). */ elapsedSeconds: number | null;
  /** Heure (ms) à laquelle le stock était à 0. */ zeroAt: number | null;
}

/**
 * Production continue : `amount` ressources à `atMs` ⇒ le stock était vide `amount / production` heures plus tôt.
 * Le temps est arrondi à la seconde.
 */
export function timeSinceEmpty(fieldLevels: readonly number[], amount: number | null, atMs: number): ResourceTiming {
  const perHour = fieldLevels.reduce((sum, level) => sum + fieldProduction(level), 0);
  if (amount === null || perHour <= 0) return { perHour, elapsedSeconds: null, zeroAt: null };
  const elapsedSeconds = Math.round((amount * 3600) / perHour);
  return { perHour, elapsedSeconds, zeroAt: atMs - elapsedSeconds * 1000 };
}
