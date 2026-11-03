/**
 * Lecture des exports du jeu collés dans #gestion-joueurs (repris de la page « MAJ joueurs » de l'appli web) :
 * la liste complète des villages (JSON), et la liste compacte à clés numérotées pour les villages neutres.
 */

/** Village de la carte, tel que stocké dans la collection Firestore `villages`. */
export interface ImportedVillage {
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
export function parseMapExport(text: string): ImportedVillage[] {
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

/**
 * Lit l'export compact des villages (objets à clés numérotées, éventuellement sans guillemets) :
 * 0 id, 1 nom, 2 kage, 3 élément, 4 x, 5 y, 6 points, 7 habitants, 8 clan, 9 village neutre.
 * Ne garde que les villages neutres (9 = true).
 */
export function parseNeutralExport(text: string): ImportedVillage[] {
  let raw: unknown;
  try {
    // `{ 0: 70, … }` n'est pas du JSON : on met les clés numériques entre guillemets.
    raw = JSON.parse(text.replace(/([{,]\s*)(\d+)\s*:/g, '$1"$2":').replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    throw new Error("Le texte collé n'est pas lisible (export coupé ?).");
  }
  if (!Array.isArray(raw)) throw new Error("L'export doit être une liste de villages ([ … ]).");
  return raw
    .filter((v) => v?.[9] === true)
    .map((v, i) => {
      if (typeof v[1] !== 'string' || typeof v[2] !== 'string' || !Number.isInteger(v[4]) || !Number.isInteger(v[5])) {
        throw new Error(`Village neutre n°${i + 1} illisible (nom, kage ou coordonnées manquants).`);
      }
      return {
        name: v[1].trim(),
        kage: v[2].trim(),
        x: v[4],
        y: v[5],
        clan: null,
        points: Math.max(0, Math.floor(Number(v[6]) || 0)),
        inhabitants: Math.max(0, Math.floor(Number(v[7]) || 0)),
        neutral: true,
      };
    });
}
