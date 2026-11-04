import { parseDuration } from '../simulation/simulation.logic';
import { BuildingLevel } from './buildings.data';
import { BuildingId } from './buildings.guides';

/** Plus haut niveau d'un bâtiment : en dessous, un niveau absent du guide est signalé comme manquant. */
export const MAX_LEVEL = 20;

/** Niveau tel que stocké dans `gameData/buildings` : les champs communs plus les effets du bâtiment. */
export type LevelRow = BuildingLevel & Record<string, unknown>;

export interface EffectField {
  key: string;
  label: string;
  /** Texte libre plutôt qu'un nombre. */ text?: boolean;
}

const POWER: EffectField = { key: 'power', label: 'Puissance (%)' };
const CAPACITY: EffectField = { key: 'capacity', label: 'Capacité' };

/** Effets propres à chaque bâtiment, à renseigner en plus des coûts. */
export const EFFECT_FIELDS: Partial<Record<BuildingId, readonly EffectField[]>> = {
  training: [POWER, { key: 'walkSpeed', label: 'Vitesse de marche (%)' }, { key: 'centisecondsPerKm', label: 'Temps par km (centièmes de s)' }],
  academy: [POWER],
  chunnin: [POWER],
  jounin: [POWER],
  watchtower: [{ key: 'comment', label: 'Commentaire', text: true }],
  wall: [{ key: 'defense', label: 'Défense (%)' }],
  hospital: [{ key: 'troopRecovery', label: 'Récupération de troupe (%)' }],
  mine: [{ key: 'productionPerHour', label: 'Production / h' }],
  resourceDepot: [CAPACITY],
  foodDepot: [CAPACITY],
  reserve: [CAPACITY],
  highCouncil: [{ key: 'members', label: 'Membres disponibles' }],
};

const COST_KEYS = ['population', 'stone', 'wood', 'iron', 'food'] as const;

export interface LevelForm {
  buildTime: string;
  /** Habitants, ressources et effets numériques ; `null` quand le champ est vide. */ numbers: Record<string, number | null>;
  /** Effets en texte libre. */ texts: Record<string, string>;
}

/** Formulaire vide pour un niveau manquant, ou prérempli pour un niveau existant. */
export function levelForm(row: LevelRow | undefined, effects: readonly EffectField[]): LevelForm {
  const form: LevelForm = { buildTime: row?.buildTime ?? '', numbers: {}, texts: {} };
  for (const key of COST_KEYS) form.numbers[key] = row?.[key] ?? null;
  for (const { key, text } of effects) {
    if (text) form.texts[key] = String(row?.[key] ?? '');
    else form.numbers[key] = typeof row?.[key] === 'number' ? row[key] : null;
  }
  return form;
}

/** Niveau prêt à enregistrer, ou le message expliquant ce qui ne va pas. */
export function readLevelForm(level: number, form: LevelForm, effects: readonly EffectField[]): { row: LevelRow } | { error: string } {
  const buildTime = form.buildTime.trim();
  try {
    if (!buildTime) return { error: 'Renseignez le temps de construction.' };
    parseDuration(buildTime);
  } catch {
    return { error: `Temps illisible : « ${buildTime} ». Écrivez par exemple « 1 j 4 h 50 min » ou « 47 min ».` };
  }
  const row: Record<string, unknown> = { level, buildTime };
  for (const key of COST_KEYS) {
    const value = form.numbers[key];
    if (value === null || !Number.isInteger(value) || value < 0) return { error: 'Les habitants et les ressources sont des nombres entiers, à partir de 0.' };
    row[key] = value;
  }
  for (const { key, label, text } of effects) {
    const value = text ? form.texts[key]?.trim() : form.numbers[key];
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && value < 0)) return { error: `Renseignez : ${label}.` };
    row[key] = value;
  }
  return { row: row as LevelRow };
}

/** Ajoute le niveau ou remplace celui qui existe, en gardant les niveaux triés. */
export function upsertLevel<T extends { level: number }>(levels: readonly T[], row: T): T[] {
  return [...levels.filter((l) => l.level !== row.level), row].sort((a, b) => a.level - b.level);
}

/** Niveaux à afficher : ceux qui existent, plus une place pour chaque niveau manquant de 1 à 20. */
export function levelEntries<T extends { level: number }>(rows: readonly T[]): { level: number; row: T | undefined }[] {
  const levels = new Set([...rows.map((r) => r.level), ...Array.from({ length: MAX_LEVEL }, (_, i) => i + 1)]);
  return [...levels].sort((a, b) => a - b).map((level) => ({ level, row: rows.find((r) => r.level === level) }));
}
