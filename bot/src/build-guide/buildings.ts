/** Partie pure du salon #build-guide : retrouver un bâtiment, afficher ses niveaux, préparer les questions. */
import { chunkFields, EmbedField, num } from '../shared/format.js';

export type LevelRow = Record<string, string | number> & { level: number };

export interface Building {
  name: string;
  levels: LevelRow[];
}

export type Buildings = Record<string, Building>;

export interface TreeEntry {
  name: string;
  description: string;
  prerequisites: { building: string; level: number }[];
}

/** Champ d'un niveau : libellé de colonne, question posée, et nature de la réponse. */
export interface LevelField {
  key: string;
  column: string;
  question: string;
  kind: 'integer' | 'decimal' | 'text';
}

const COMMON_FIELDS: readonly LevelField[] = [
  { key: 'level', column: 'Niv', question: 'Quel **niveau** ajoutes-tu ?', kind: 'integer' },
  { key: 'buildTime', column: 'Temps', question: 'Quel est le **temps de construction** ? (tel qu’affiché dans le jeu, ex. `2 h 12 min`)', kind: 'text' },
  { key: 'population', column: 'Hab', question: 'Combien d’**habitants** ce niveau demande-t-il ?', kind: 'integer' },
  { key: 'stone', column: 'Pierre', question: 'Combien de **pierre** ?', kind: 'integer' },
  { key: 'wood', column: 'Bois', question: 'Combien de **bois** ?', kind: 'integer' },
  { key: 'iron', column: 'Fer', question: 'Combien de **fer** ?', kind: 'integer' },
  { key: 'food', column: 'Nourr', question: 'Combien de **nourriture** ?', kind: 'integer' },
];

/** Champs propres à certains bâtiments, reconnus d'après les niveaux déjà connus. */
const EXTRA_FIELDS: readonly LevelField[] = [
  { key: 'power', column: 'Puiss%', question: 'Quel **bonus de puissance** (en %) ?', kind: 'decimal' },
  { key: 'walkSpeed', column: 'Marche%', question: 'Quel **bonus de vitesse de marche** (en %) ?', kind: 'decimal' },
  { key: 'centisecondsPerKm', column: 'cs/km', question: 'Quel **temps par km** en centièmes de seconde ? (ex. `9371` pour 93,71 s)', kind: 'integer' },
  { key: 'defense', column: 'Déf%', question: 'Quel **bonus de défense** (en %) ?', kind: 'decimal' },
  { key: 'troopRecovery', column: 'Récup%', question: 'Quelle **récupération de troupes** (en %) ?', kind: 'decimal' },
  { key: 'productionPerHour', column: 'Prod/h', question: 'Quelle **production par heure** ?', kind: 'integer' },
  { key: 'capacity', column: 'Capacité', question: 'Quelle **capacité de stockage** ?', kind: 'integer' },
  { key: 'members', column: 'Membres', question: 'Combien de **membres** de clan ?', kind: 'integer' },
  { key: 'comment', column: 'Info', question: 'Quelles **informations** ce niveau débloque-t-il ?', kind: 'text' },
];

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Noms courts acceptés en plus du nom complet et de la clé. */
const ALIASES: Record<string, string[]> = {
  hq: ['qg', 'quartier'],
  training: ['ce', 'camp', 'centre entrainement', 'entrainement'],
  academy: ['academie', 'acad'],
  chunnin: ['chuunin', 'chunin', 'centre chunin'],
  jounin: ['centre jounin'],
  watchtower: ['tour', 'tour de garde'],
  wall: ['mur'],
  hospital: ['hopital', 'hosto'],
  mine: ['mines', 'champ', 'champs'],
  resourceDepot: ['depot', 'depot ressources', 'ressources'],
  foodDepot: ['depot nourriture', 'nourriture'],
  reserve: ['reserve'],
  raptor: ['rapaces', 'elevage'],
  commerce: ['commerces'],
  highCouncil: ['hc', 'haut conseil', 'conseil'],
};

/** Bâtiment désigné par `query` (clé, nom ou alias, sans accents ni majuscules), ou les candidats possibles. */
export function findBuilding(buildings: Buildings, query: string): { key: string; building: Building } | { candidates: string[] } {
  const q = norm(query);
  if (!q) return { candidates: [] };
  const names = (key: string) => [key, buildings[key].name, ...(ALIASES[key] ?? [])].map(norm);
  const exact = Object.keys(buildings).find((key) => names(key).includes(q));
  if (exact) return { key: exact, building: buildings[exact] };
  const partial = Object.keys(buildings).filter((key) => names(key).some((n) => n.includes(q) || q.includes(n)));
  if (partial.length === 1) return { key: partial[0], building: buildings[partial[0]] };
  return { candidates: partial.map((key) => buildings[key].name) };
}

/** Questions à poser pour un nouveau niveau : les champs communs, puis ceux que ce bâtiment utilise déjà. */
export function fieldsFor(building: Building): LevelField[] {
  const used = new Set(building.levels.flatMap((l) => Object.keys(l)));
  return [...COMMON_FIELDS, ...EXTRA_FIELDS.filter((f) => used.has(f.key))];
}

/** Réponse à une question, ou un message d'erreur. Les nombres acceptent les espaces (« 1 234 ») et la virgule. */
export function parseAnswer(field: LevelField, answer: string): { value: string | number } | { error: string } {
  const text = answer.trim();
  if (!text) return { error: 'Réponse vide.' };
  if (field.kind === 'text') return { value: text.slice(0, 200) };
  const value = Number(text.replace(/[\s  ]/g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) return { error: 'Il faut un nombre positif.' };
  if (field.kind === 'integer' && !Number.isInteger(value)) return { error: 'Il faut un nombre entier.' };
  if (field.key === 'level' && (value < 0 || value > 100)) return { error: 'Niveau entre 0 et 100.' };
  return { value };
}

/**
 * Valeur proposée pour un champ d'un nouveau niveau, prolongée à partir des deux niveaux connus les plus proches
 * (ex. Académie : 36 % au niv. 11, 42 % au niv. 12 → 48 % au niv. 13). Null si on ne peut pas la déduire.
 */
export function suggestValue(levels: readonly LevelRow[], key: string, level: number): number | null {
  const known = levels
    .filter((l) => typeof l[key] === 'number' && l.level !== level)
    .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level) || a.level - b.level)
    .slice(0, 2);
  if (known.length < 2) return known.length === 1 ? (known[0][key] as number) : null;
  const [a, b] = known;
  const slope = ((b[key] as number) - (a[key] as number)) / (b.level - a.level);
  return Math.round(((a[key] as number) + slope * (level - a.level)) * 100) / 100;
}

/** Niveaux triés, avec le nouveau niveau (qui remplace celui de même numéro). */
export function withLevel(levels: readonly LevelRow[], row: LevelRow): LevelRow[] {
  return [...levels.filter((l) => l.level !== row.level), row].sort((a, b) => a.level - b.level);
}

const cell = (v: string | number | undefined): string => (v === undefined ? '—' : typeof v === 'number' ? num(v) : v);

/** Affichage des champs propres à certains bâtiments (émoji, libellé, unité). */
const EXTRA_DISPLAY: Record<string, (v: number | string) => string> = {
  power: (v) => `⚔️ Puissance +${num(Number(v))} %`,
  walkSpeed: (v) => `🏃 Marche +${num(Number(v))} %`,
  centisecondsPerKm: (v) => `🗺️ ${num(Number(v) / 100)} s/km`,
  defense: (v) => `🛡️ Défense +${num(Number(v))} %`,
  troopRecovery: (v) => `🏥 Soigne ${num(Number(v))} %`,
  productionPerHour: (v) => `⛏️ ${num(Number(v))} /h`,
  capacity: (v) => `📦 Stockage ${num(Number(v))}`,
  members: (v) => `👤 ${num(Number(v))} membres`,
  comment: (v) => `ℹ️ ${v}`,
};

/** Une fiche de niveau : titre « Niveau 8 · ⏱️ 2 h 12 min », puis coûts et effets, sur des lignes courtes (téléphone). */
export function levelField(row: LevelRow): { name: string; value: string } {
  const costs = `🪨 ${cell(row['stone'])}  🪵 ${cell(row['wood'])}  ⚙️ ${cell(row['iron'])}  🍖 ${cell(row['food'])}`;
  const extras = Object.keys(EXTRA_DISPLAY)
    .filter((k) => row[k] !== undefined)
    .map((k) => EXTRA_DISPLAY[k](row[k]));
  const second = [`👥 ${cell(row['population'])} hab.`, ...extras.filter((e) => !e.startsWith('ℹ️'))].join('  ·  ');
  const info = extras.find((e) => e.startsWith('ℹ️'));
  return {
    name: `Niveau ${row.level}  ·  ⏱️ ${cell(row['buildTime'])}`,
    value: [costs, second, info].filter(Boolean).join('\n'),
  };
}

/** Une fiche par niveau, regroupées en paquets sous les limites d'un message Discord. */
export const levelFieldPages = (levels: readonly LevelRow[]): EmbedField[][] => chunkFields(levels.map(levelField));

/** Ligne « Prérequis : … » d'après l'arbre des constructions. */
export function prerequisitesLine(tree: readonly TreeEntry[], building: Building): string | null {
  const entry = tree.find((t) => norm(t.name) === norm(building.name));
  if (!entry) return null;
  return entry.prerequisites.length
    ? `Prérequis : ${entry.prerequisites.map((p) => `${p.building} niv. ${p.level}`).join(', ')}`
    : 'Prérequis : aucun';
}

/** Résumé d'un niveau saisi, pour confirmation. */
export function levelSummary(row: LevelRow): string {
  const { name, value } = levelField(row);
  return `**${name}**\n${value}`;
}
