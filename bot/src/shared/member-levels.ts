/** Niveaux de bâtiments d'un membre (#gestion-joueurs) : `!mesNiveaux` et une commande par bâtiment. */

export type MemberLevelKey = 'ce' | 'academy' | 'chunnin' | 'jounin' | 'wall' | 'hospital';
export type MemberLevels = Partial<Record<MemberLevelKey, number>>;

/** Ordre de `!mesNiveaux <CE> <académie> <chunin> <jounin> <mur> <hôpital>`. */
export const LEVEL_ORDER: readonly { key: MemberLevelKey; label: string; command: string }[] = [
  { key: 'ce', label: 'CE', command: '!monCE' },
  { key: 'academy', label: 'Académie', command: '!monAcademie' },
  { key: 'chunnin', label: 'Centre Chunin', command: '!monChunin' },
  { key: 'jounin', label: 'Centre Jounin', command: '!monJounin' },
  { key: 'wall', label: 'Mur', command: '!monMur' },
  { key: 'hospital', label: 'Hôpital', command: '!monHopital' },
];

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Commande individuelle → niveau concerné (« !monChuunin », « !monHôpital »… acceptés). */
export function levelOfCommand(command: string): MemberLevelKey | null {
  const c = norm(command).replace(/^!mon/, '');
  const aliases: Record<string, MemberLevelKey> = {
    ce: 'ce', camp: 'ce',
    academie: 'academy', acad: 'academy',
    chunin: 'chunnin', chuunin: 'chunnin',
    jounin: 'jounin',
    mur: 'wall',
    hopital: 'hospital', hosto: 'hospital',
  };
  return norm(command).startsWith('!mon') ? (aliases[c] ?? null) : null;
}

const parseLevel = (text: string): number | null | undefined => {
  if (text === '?' || text === '-') return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : undefined;
};

/**
 * `!mesNiveaux 11 8 8 5 7 3` → les 6 niveaux ; `?` laisse un niveau tel quel. Retourne les niveaux à enregistrer
 * ou une erreur. Il en faut exactement 6, de 0 à 20.
 */
export function parseAllLevels(args: readonly string[]): { levels: MemberLevels } | { error: string } {
  if (args.length !== LEVEL_ORDER.length) {
    return { error: `Il faut les 6 niveaux dans l'ordre : CE, Académie, Chunin, Jounin, Mur, Hôpital. Ex. \`!mesNiveaux 11 8 8 5 7 3\` (\`?\` pour ne pas changer).` };
  }
  const levels: MemberLevels = {};
  for (const [i, { key, label }] of LEVEL_ORDER.entries()) {
    const value = parseLevel(args[i]);
    if (value === undefined) return { error: `${label} : « ${args[i]} » n'est pas un niveau de 0 à 20.` };
    if (value !== null) levels[key] = value;
  }
  return { levels };
}

/** Un seul niveau (commande individuelle) ; null si illisible. */
export const parseOneLevel = (text: string): number | null => parseLevel(text.trim()) ?? null;

/** « CE 11 · Académie 8 · Centre Chunin 8 · Centre Jounin ? · Mur 7 · Hôpital 3 » */
export const levelsSummary = (levels: MemberLevels): string =>
  LEVEL_ORDER.map(({ key, label }) => `${label} ${levels[key] ?? '?'}`).join(' · ');
