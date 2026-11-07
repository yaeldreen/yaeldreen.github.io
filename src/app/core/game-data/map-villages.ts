/** Dernière armée connue du joueur (troupes restantes d'après son dernier rapport). */
export interface VillageArmy {
  troops: { genin: number; chuunin: number; jounin: number };
  side: 'Assaillant' | 'Défenseur' | null;
  /** Date ISO de l'enregistrement */ updatedAt: string;
}

/** Infos saisies à la main sur le joueur du village : les imports les conservent. */
export interface VillageNotes {
  /** Identifiant du village dans le jeu (négatif pour un village neutre) : il survit aux renommages. */
  gameId?: number;
  army?: VillageArmy;
  ce?: number | null;
  academy?: number | null;
  chunninCenter?: number | null;
  jouninCenter?: number | null;
  hospital?: number | null;
  wall?: number | null;
  /** Date ISO de création du compte, relevée à la main sur le jeu. */
  createdAt?: string;
  comment?: string;
  commentBy?: string;
  commentAt?: string;
}

const NOTE_KEYS: readonly (keyof VillageNotes)[] = ['gameId', 'army', 'ce', 'academy', 'chunninCenter', 'jouninCenter', 'hospital', 'wall', 'createdAt', 'comment', 'commentBy', 'commentAt'];

export const notesOf = (village: VillageNotes | undefined): VillageNotes =>
  Object.fromEntries(NOTE_KEYS.flatMap((k) => (village?.[k] !== undefined ? [[k, village[k]]] : [])));

/** Village de la carte, tel que stocké dans la collection Firestore `villages`. */
export interface MapVillage extends VillageNotes {
  name: string;
  /** Nom du joueur */ kage: string;
  x: number;
  y: number;
  clan: string | null;
  points: number;
  inhabitants: number;
  /** Village neutre (sans joueur), pillable mais absent des listes de joueurs. */ neutral: boolean;
}

/** Champ à ajouter si l'export donne un identifiant : Firestore refuse les valeurs `undefined`. */
const gameIdOf = (id: unknown): { gameId?: number } => (Number.isInteger(id) ? { gameId: id as number } : {});

/** Document de `villages` : un joueur ajouté à la main, absent de la carte, n'a pas de coordonnées. */
export type VillageDoc = Omit<MapVillage, 'x' | 'y'> & { x?: number; y?: number };

export const hasCoordinates = (doc: VillageDoc): doc is MapVillage => doc.x !== undefined && doc.y !== undefined;

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
      ...gameIdOf(v.id),
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

/** Ligne de l'export du classement : un village de joueur, sans coordonnées. */
export type RankingEntry = Omit<MapVillage, 'x' | 'y' | 'neutral'>;

/**
 * Lit l'export du classement (villages sans « x » ni « y »).
 * Retourne null si le texte n'est pas de cette forme : il sera alors lu comme un export de la carte.
 */
export function parseRankingExport(text: string): RankingEntry[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || !raw.length || raw.some((v) => v?.x !== undefined || v?.y !== undefined)) return null;
  return raw.map((v, i) => {
    if (!v || typeof v.name !== 'string' || typeof v.kage !== 'string' || (v.clan !== null && typeof v.clan?.name !== 'string')) {
      throw new Error(`Joueur n°${i + 1} illisible (village, joueur ou clan manquant).`);
    }
    return {
      ...gameIdOf(v.id),
      name: v.name.trim(),
      kage: v.kage.trim(),
      clan: v.clan?.name ?? null,
      points: Math.max(0, Math.floor(Number(v.points) || 0)),
      inhabitants: Math.max(0, Math.floor(Number(v.inhabitants) || 0)),
    };
  });
}

/**
 * Reporte le classement sur les villages connus (par nom du village, sinon du joueur) en gardant leurs coordonnées.
 * Un joueur absent de la carte ne peut pas y être placé sans coordonnées : son nom est retourné dans `unknown`.
 */
export function mergeRanking(villages: readonly VillageDoc[], ranking: readonly RankingEntry[]): { villages: MapVillage[]; unknown: string[] } {
  const merged: MapVillage[] = [];
  const unknown: string[] = [];
  for (const entry of ranking) {
    const known = findPlayerVillage(villages, entry);
    if (known && hasCoordinates(known)) merged.push({ ...known, ...entry });
    else unknown.push(entry.kage);
  }
  return { villages: merged, unknown };
}

/**
 * Lit l'export compact de la carte (lignes en tableaux, ou objets à clés numérotées éventuellement sans guillemets) :
 * 0 id, 1 nom, 2 kage, 3 élément, 4 x, 5 y, 6 habitants, 7 points, 8 clan ({ name } ou null), 9 village neutre.
 */
export function parseCompactExport(text: string): { neutral: MapVillage[]; players: MapVillage[] } {
  let raw: unknown;
  try {
    // `{ 0: 70, … }` n'est pas du JSON : on met les clés numériques entre guillemets.
    raw = JSON.parse(text.replace(/([{,]\s*)(\d+)\s*:/g, '$1"$2":').replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    throw new Error("Le texte collé n'est pas lisible (export coupé ?).");
  }
  if (!Array.isArray(raw)) throw new Error("L'export doit être une liste de villages ([ … ]).");
  const villages = raw.map((v, i): MapVillage => {
    if (typeof v?.[1] !== 'string' || typeof v[2] !== 'string' || !Number.isInteger(v[4]) || !Number.isInteger(v[5])) {
      throw new Error(`Village n°${i + 1} illisible (nom, kage ou coordonnées manquants).`);
    }
    return {
      ...gameIdOf(v[0]),
      name: v[1].trim(),
      kage: v[2].trim(),
      x: v[4],
      y: v[5],
      clan: typeof v[8]?.name === 'string' ? v[8].name.trim() : null,
      points: Math.max(0, Math.floor(Number(v[7]) || 0)),
      inhabitants: Math.max(0, Math.floor(Number(v[6]) || 0)),
      neutral: v[9] === true,
    };
  });
  return { neutral: villages.filter((v) => v.neutral), players: villages.filter((v) => !v.neutral) };
}

/**
 * Applique la carte sur les villages connus (par identifiant, nom du village, sinon du joueur) : coordonnées, clan, points
 * et habitants viennent de l'export, l'armée et les notes saisies à la main sont conservées.
 */
export function applyCarte(villages: readonly VillageDoc[], fromMap: readonly MapVillage[]): MapVillage[] {
  return fromMap.map((v) => ({ ...findPlayerVillage(villages, v), ...v }));
}

const normName = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Joueurs dont ni le nom ni le village ne figurent dans la liste de la carte : ils n'existent plus. */
export function playersMissingFromCarte<T extends { name: string; village?: string }>(players: readonly T[], fromMap: readonly MapVillage[]): T[] {
  const key = (s: string) => s.trim().toLocaleLowerCase('fr');
  const kages = new Set(fromMap.map((v) => key(v.kage)));
  const names = new Set(fromMap.map((v) => key(v.name)));
  return players.filter((p) => !kages.has(key(p.name)) && !names.has(key(p.village ?? '')));
}

/**
 * Village de joueur correspondant à une ligne d'export : l'identifiant du jeu d'abord, puis le nom exact (« Sparta » et
 * « SPÄRTÄ » sont deux villages), puis le joueur, puis les mêmes sans accents ni casse.
 */
function findPlayerVillage(villages: readonly VillageDoc[], { gameId, name, kage }: { gameId?: number; name: string; kage: string }): VillageDoc | undefined {
  const players = villages.filter((v) => !v.neutral);
  return (
    (gameId !== undefined ? players.find((v) => v.gameId === gameId) : undefined) ??
    players.find((v) => v.name === name) ??
    players.find((v) => v.kage === kage) ??
    players.find((v) => normName(v.name) === normName(name)) ??
    players.find((v) => normName(v.kage) === normName(kage))
  );
}

/** Village dont le nom (ou le joueur) correspond, sans tenir compte des accents, de la casse ni des espaces. */
export function findVillage(villages: readonly MapVillage[], name: string): MapVillage | null {
  const key = normName(name);
  if (!key) return null;
  // Le nom exact d'abord : « Sparta » et « SPÄRTÄ » sont deux villages.
  return (
    villages.find((v) => v.name === name.trim()) ??
    villages.find((v) => v.kage === name.trim()) ??
    villages.find((v) => normName(v.name) === key) ??
    villages.find((v) => normName(v.kage) === key) ??
    null
  );
}

/** Options de liste déroulante : villages triés, avec le joueur en indication. */
export const villageOptions = (villages: readonly MapVillage[]): { value: string; hint: string }[] =>
  villages.map((v) => ({ value: v.name, hint: v.kage })).sort((a, b) => a.value.localeCompare(b.value, 'fr'));
