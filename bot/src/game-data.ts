import { db } from './firebase.js';
import type { Buildings, LevelRow, TreeEntry } from './build-guide/buildings.js';
import type { CombatRules, TroopCounts } from './combat/combat.js';
import type { TravelData } from './retours/travel.js';
import type { TroopsData } from './pillages/plunder.js';
import type { FieldCounts, FieldLevels } from './calcul-seconde/production.js';
import type { MonthlySnapshot } from './gestion-joueurs/monthly-snapshot.js';

/** Joueur connu (collection `players`, alimentée par l'appli : carte, infos ennemis). */
export interface KnownPlayer {
  name: string;
  village: string;
  clan: string | null;
  points?: number | null;
  inhabitants?: number | null;
  /** Commentaire libre (#infos-ennemis), avec son auteur et sa date. */ comment?: string;
  commentBy?: string;
  commentAt?: string;
  ce?: number | null;
  academy?: number | null;
  chunninCenter?: number | null;
  jouninCenter?: number | null;
  hospital?: number | null;
  wall?: number | null;
}

/** Dernière armée connue d'un joueur (collection `enemies`). */
export interface ArmyRecord {
  player: string;
  troops: TroopCounts;
  /** Camp du joueur dans le rapport qui a donné cette armée. */ side?: 'Assaillant' | 'Défenseur' | null;
  updatedAt: string;
}

/** Village de la carte (collection `villages`, importée avec la liste des joueurs). */
export interface MapVillage {
  name: string;
  /** Joueur */ kage: string;
  x: number;
  y: number;
  clan: string | null;
  neutral: boolean;
}

/** Réglages d'un membre Discord (collection `discordUsers`, écrite uniquement par le bot). */
export interface MemberProfile {
  /** Joueur du jeu relié à ce membre (par son pseudo ou `!lier`). */ player?: string;
  /** Son village sur la carte (point de départ de ses contre-attaques). */ village?: string;
  /** Niveau de son Camp d'entraînement. */ ce?: number;
  /** Ses autres niveaux (`!mesNiveaux`, #gestion-joueurs). */ academy?: number;
  chunnin?: number;
  jounin?: number;
  wall?: number;
  hospital?: number;
  /** Dernière armée disponible saisie pour l'optimisation d'attaque (#simu-combat). */ available?: TroopCounts;
  /** Niveaux de ses champs (#calcul-seconde). */ fields?: FieldLevels;
  /** Ses 2 derniers raz (#simu-raz). */ razHistory?: unknown[];
}

/** Clé d'un joueur dans les armées connues, comme dans l'appli. */
export const playerKey = (name: string): string => name.trim().toLocaleLowerCase('fr');

/**
 * Données de jeu (collection `gameData`), gardées à jour en direct : une modification faite par le bot
 * ou envoyée par le script est visible tout de suite, sans redémarrer.
 */
export const gameData: {
  buildings: Buildings | null;
  tree: TreeEntry[];
  combat: CombatRules | null;
  players: KnownPlayer[];
  /** Armées connues, par `playerKey`. */ armies: Map<string, ArmyRecord>;
  travel: TravelData | null;
  villages: MapVillage[];
  /** Noms des clans (collection `clans`). */ clans: string[];
  /** Capacités de pillage des troupes (gameData/troops). */ troops: TroopsData | null;
  /** Nombre de champs par ressource (gameData/production). */ fieldCounts: FieldCounts | null;
  /** Relevés mensuels des points et habitants. */ snapshots: { current: MonthlySnapshot | null; previous: MonthlySnapshot | null };
} = {
  buildings: null,
  tree: [],
  combat: null,
  players: [],
  armies: new Map(),
  travel: null,
  villages: [],
  clans: [],
  troops: null,
  fieldCounts: null,
  snapshots: { current: null, previous: null },
};

const BUILDINGS = db.collection('gameData').doc('buildings');

export function watchGameData(): void {
  BUILDINGS.onSnapshot(
    (snapshot) => {
      const { updatedAt: _a, updatedBy: _b, ...buildings } = (snapshot.data() ?? {}) as Buildings & { updatedAt?: unknown; updatedBy?: unknown };
      gameData.buildings = buildings as Buildings;
    },
    (error) => console.error('Lecture de gameData/buildings impossible :', error.message),
  );
  db.collection('gameData')
    .doc('tree')
    .onSnapshot(
      (snapshot) => (gameData.tree = (snapshot.data()?.['buildings'] as TreeEntry[] | undefined) ?? []),
      (error) => console.error('Lecture de gameData/tree impossible :', error.message),
    );
  db.collection('gameData')
    .doc('combat')
    .onSnapshot(
      (snapshot) => (gameData.combat = (snapshot.data() as CombatRules | undefined) ?? null),
      (error) => console.error('Lecture de gameData/combat impossible :', error.message),
    );
  db.collection('gameData')
    .doc('travel')
    .onSnapshot(
      (snapshot) => (gameData.travel = (snapshot.data() as TravelData | undefined) ?? null),
      (error) => console.error('Lecture de gameData/travel impossible :', error.message),
    );
  db.collection('villages').onSnapshot(
    (snapshot) => (gameData.villages = snapshot.docs.map((d) => d.data() as MapVillage)),
    (error) => console.error('Lecture de la carte impossible :', error.message),
  );
  db.collection('gameData')
    .doc('troops')
    .onSnapshot(
      (snapshot) => (gameData.troops = (snapshot.data() as TroopsData | undefined) ?? null),
      (error) => console.error('Lecture de gameData/troops impossible :', error.message),
    );
  db.collection('gameData')
    .doc('production')
    .onSnapshot(
      (snapshot) => (gameData.fieldCounts = (snapshot.get('fieldCounts') as FieldCounts | undefined) ?? null),
      (error) => console.error('Lecture de gameData/production impossible :', error.message),
    );
  db.collection('clans').onSnapshot(
    (snapshot) => (gameData.clans = snapshot.docs.map((d) => String(d.get('name') ?? '')).filter(Boolean)),
    (error) => console.error('Lecture des clans impossible :', error.message),
  );
  db.collection('snapshots').onSnapshot(
    (snapshot) => {
      const byId = Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data() as MonthlySnapshot]));
      gameData.snapshots = { current: byId['current'] ?? null, previous: byId['previous'] ?? null };
    },
    (error) => console.error('Lecture des relevés mensuels impossible :', error.message),
  );
  db.collection('players').onSnapshot(
    (snapshot) => (gameData.players = snapshot.docs.map((d) => d.data() as KnownPlayer)),
    (error) => console.error('Lecture des joueurs impossible :', error.message),
  );
  db.collection('enemies').onSnapshot(
    (snapshot) => {
      gameData.armies = new Map(snapshot.docs.map((d) => d.data() as ArmyRecord).map((r) => [playerKey(r.player), r]));
    },
    (error) => console.error('Lecture des armées impossible :', error.message),
  );
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Joueur désigné par son village ou son nom (sans accents ni majuscules). */
export function findPlayer(name: string): KnownPlayer | null {
  return lookupPlayer(gameData.players, name);
}

/**
 * Joueur désigné par son village ou son nom, sans accents ni majuscules : d'abord le nom exact, sinon le seul joueur
 * dont le nom ou le village commence par le texte, sinon le seul qui le contient (« malice » → Malice at the pa).
 * Plusieurs candidats : on ne devine pas (null).
 */
export function lookupPlayer<T extends { name: string; village: string }>(players: readonly T[], name: string): T | null {
  const target = normalize(name);
  if (!target) return null;
  const exact = players.find((p) => normalize(p.village) === target) ?? players.find((p) => normalize(p.name) === target);
  if (exact) return exact;
  for (const test of [(s: string) => s.startsWith(target), (s: string) => s.includes(target)]) {
    const found = players.filter((p) => test(normalize(p.name)) || test(normalize(p.village)));
    if (found.length === 1) return found[0];
    if (found.length > 1) return null;
  }
  return null;
}

/** Village de la carte désigné par son nom ou celui de son joueur (sans accents ni majuscules). */
export function findVillage(name: string): MapVillage | null {
  const target = normalize(name);
  if (!target) return null;
  return gameData.villages.find((v) => normalize(v.name) === target) ?? gameData.villages.find((v) => normalize(v.kage) === target) ?? null;
}

const PROFILES = db.collection('discordUsers');
const profiles = new Map<string, MemberProfile>();

export async function getProfile(userId: string): Promise<MemberProfile> {
  if (!profiles.has(userId)) profiles.set(userId, ((await PROFILES.doc(userId).get()).data() as MemberProfile | undefined) ?? {});
  return profiles.get(userId)!;
}

/** Retire la liaison joueur / village d'un membre (son CE est gardé). */
export async function unlinkProfile(userId: string): Promise<void> {
  const { player: _p, village: _v, ...rest } = await getProfile(userId);
  await PROFILES.doc(userId).set(rest);
  profiles.set(userId, rest);
}

/** Oublie l'armée disponible d'un membre (`!dispo aucune`). */
export async function removeAvailable(userId: string): Promise<void> {
  const { available: _a, ...rest } = await getProfile(userId);
  await PROFILES.doc(userId).set(rest);
  profiles.set(userId, rest);
}

/** Tous les membres reliés à un joueur. */
export async function linkedProfiles(): Promise<{ userId: string; profile: MemberProfile }[]> {
  return (await PROFILES.get()).docs.map((d) => ({ userId: d.id, profile: d.data() as MemberProfile })).filter((m) => m.profile.player || m.profile.village);
}

export async function updateProfile(userId: string, changes: MemberProfile): Promise<MemberProfile> {
  const next = { ...(await getProfile(userId)), ...changes };
  await PROFILES.doc(userId).set(next, { merge: true });
  profiles.set(userId, next);
  return next;
}

/** Ajoute ou remplace un niveau, dans une transaction (deux éditeurs en même temps ne s'écrasent pas). */
export async function saveLevel(key: string, levels: (current: readonly LevelRow[]) => LevelRow[], editor: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(BUILDINGS);
    const building = snapshot.get(key) as { name: string; levels: LevelRow[] } | undefined;
    if (!building) throw new Error(`Bâtiment inconnu : ${key}`);
    tx.update(BUILDINGS, {
      [`${key}.levels`]: levels(building.levels),
      updatedAt: new Date().toISOString(),
      updatedBy: editor,
    });
  });
}
