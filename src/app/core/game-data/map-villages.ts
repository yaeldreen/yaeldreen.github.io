/** Village de la carte, tel que stocké dans la collection Firestore `villages`. */
export interface MapVillage {
  name: string;
  /** Nom du joueur */ kage: string;
  x: number;
  y: number;
  clan: string | null;
  points: number;
  inhabitants: number;
  /** Village neutre (sans joueur), pillable mais absent des listes de joueurs. */ neutral: boolean;
}

/**
 * Lit l'export JSON de la carte du jeu (tableau de villages) collé par un joueur.
 * Lève une erreur lisible si le texte n'a pas la bonne forme.
 */
export function parseMapExport(text: string): MapVillage[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Le texte collé n'est pas du JSON valide (export coupé ?).");
  }
  if (!Array.isArray(raw)) throw new Error("L'export doit être une liste de villages ([ … ]).");
  return raw.map((v, i) => {
    const ok =
      v &&
      typeof v.name === 'string' &&
      typeof v.kage === 'string' &&
      Number.isInteger(v.x) &&
      Number.isInteger(v.y) &&
      (v.clan === null || typeof v.clan?.name === 'string');
    if (!ok) throw new Error(`Village n°${i + 1} illisible (nom, joueur, coordonnées ou clan manquant).`);
    return {
      name: v.name.trim(),
      kage: v.kage.trim(),
      x: v.x,
      y: v.y,
      clan: v.clan?.name ?? null,
      points: Math.max(0, Math.floor(Number(v.points) || 0)),
      inhabitants: Math.max(0, Math.floor(Number(v.inhabitants) || 0)),
      neutral: v.neutral === true,
    };
  });
}

const normName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Village dont le nom (ou le joueur) correspond, sans tenir compte des accents, de la casse ni des espaces. */
export function findVillage(villages: readonly MapVillage[], name: string): MapVillage | null {
  const key = normName(name);
  if (!key) return null;
  return villages.find((v) => normName(v.name) === key) ?? villages.find((v) => normName(v.kage) === key) ?? null;
}

/** Options de liste déroulante : villages triés, avec le joueur en indication. */
export const villageOptions = (villages: readonly MapVillage[]): { value: string; hint: string }[] =>
  villages.map((v) => ({ value: v.name, hint: v.kage })).sort((a, b) => a.value.localeCompare(b.value, 'fr'));
