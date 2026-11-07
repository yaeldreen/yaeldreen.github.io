import { MapVillage, VillageDoc } from '../../core/game-data/map-villages';
import { NO_CLAN, OWN_CLAN } from '../enemies/clans.data';
import { computeDistance } from '../travel/travel.logic';

export const NEUTRAL_GROUP = 'Villages neutres';
const NEUTRAL_COLOR = '#3ce3b2';
/** Couleur de notre clan sur la carte (triangles), reprise par le bouton « Soutien ». */
export const OWN_COLOR = '#77afff';
/** Bouton « Attaque » d'un village neutre. */
const NEUTRAL_ATTACK_COLOR = '#f3e08a';
const NO_CLAN_COLOR = '#b7b0a5';
// Couleurs des clans choisies pour rester distinctes aussi pour un daltonien rouge-vert (simulation deutéranopie et protanopie).
// Elles ne suffisent pas pour 9 clans : la forme du point distingue en plus les groupes particuliers (voir `groupShape`).
const PALETTE = ['#f0e442', '#e69f00', '#56b4e9', '#cc79a7', '#ffffff', '#d55e00', '#9ad0ff', '#ffb000', '#dc267f'];

/** Taille de la carte en unités du dessin (deux fois plus large que haute), et marge laissée au bord. */
export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 300;
const MAP_MARGIN = 22;
/** Portée minimale en km, pour ne pas tout grossir quand peu de villages sont affichés. */
const MIN_EXTENT_X = 10;
const MIN_EXTENT_Y = 5;

export const GAME_URL = 'https://worldofshinobi.com';

export interface GameLink {
  label: string;
  url: string;
  /** Le lien principal, mis en avant. */ primary: boolean;
  /** Couleur propre du bouton (texte sombre) : soutien aux couleurs de notre clan, attaque d'un neutre en jaune pâle. */ color?: string;
}

export type AttackMode = 'pillage' | 'combat';

/** Armée et mode reportés sur le formulaire d'attaque du jeu par le script de préremplissage. */
export interface AttackPlan {
  genin: number | null;
  chuunin: number | null;
  jounin: number | null;
  mode: AttackMode;
}

export const DEFAULT_ATTACK_PLAN: AttackPlan = { genin: 1, chuunin: 0, jounin: 0, mode: 'pillage' };

const troopCount = (value: number | null): number => Math.max(0, Math.floor(Number(value) || 0));

export const planHash = ({ genin, chuunin, jounin, mode }: AttackPlan): string =>
  `#radar=${troopCount(genin)},${troopCount(chuunin)},${troopCount(jounin)},${mode}`;

/**
 * Liens vers le jeu. Joueur : village, profil et attaque. Membre de notre clan : le jeu refuse de l'attaquer, le dernier
 * lien est donc un soutien. Village neutre : attaque seulement. Sans `plan`, l'attaque n'est ni préremplie ni envoyée par le script.
 */
export function gameLinks({ gameId, neutral, clan }: Pick<VillageDoc, 'gameId' | 'neutral' | 'clan'>, plan: AttackPlan | null = null): GameLink[] {
  if (gameId === undefined) return [];
  const url = (page: string) => `${GAME_URL}/${page}.html?id=${encodeURIComponent(gameId)}`;
  const attack = { label: 'Attaque', url: url('attaque') + (plan ? planHash(plan) : ''), primary: true };
  if (neutral) return [{ ...attack, color: NEUTRAL_ATTACK_COLOR }];
  const last = clan === OWN_CLAN ? { label: 'Soutien', url: `${url('attaque')}&mode=support`, primary: true, color: OWN_COLOR } : attack;
  return [{ label: 'Village', url: url('joueur'), primary: false }, { label: 'Profil', url: url('profil'), primary: false }, last];
}

export interface RadarGroup {
  name: string;
  count: number;
  color: string;
  shape: GroupShape;
}

/** Forme du point sur la carte : notre clan, les neutres et les sans clan se reconnaissent sans compter sur la couleur. */
export type GroupShape = 'circle' | 'square' | 'triangle' | 'ring';
export const groupShape = (name: string): GroupShape =>
  name === NEUTRAL_GROUP ? 'square' : name === OWN_CLAN ? 'triangle' : name === NO_CLAN ? 'ring' : 'circle';

export const groupOf = (village: MapVillage): string => (village.neutral ? NEUTRAL_GROUP : (village.clan ?? NO_CLAN));

/** Ce qu'on peut afficher : villages neutres, notre clan, les autres clans, puis les joueurs sans clan. */
export function radarGroups(villages: readonly MapVillage[]): RadarGroup[] {
  const counts = new Map<string, number>();
  for (const village of villages) counts.set(groupOf(village), (counts.get(groupOf(village)) ?? 0) + 1);
  const special = [NEUTRAL_GROUP, OWN_CLAN, NO_CLAN];
  const clans = [...counts.keys()].filter((name) => !special.includes(name)).sort((a, b) => a.localeCompare(b, 'fr'));
  const color = (name: string, i: number): string =>
    name === NEUTRAL_GROUP ? NEUTRAL_COLOR : name === OWN_CLAN ? OWN_COLOR : name === NO_CLAN ? NO_CLAN_COLOR : PALETTE[i % PALETTE.length];
  return [NEUTRAL_GROUP, OWN_CLAN, ...clans, NO_CLAN]
    .filter((name) => counts.has(name))
    .map((name) => ({ name, count: counts.get(name) ?? 0, color: color(name, clans.indexOf(name)), shape: groupShape(name) }));
}

/** Échelle du dessin : les écarts en x et en y du village affiché le plus éloigné doivent tenir dans le cadre. */
export function mapScale(origin: MapVillage, visible: readonly MapVillage[]): number {
  const extent = (of: (v: MapVillage) => number, min: number) => Math.max(min, ...visible.map((v) => Math.abs(of(v) - of(origin)) + 1));
  return Math.min((MAP_WIDTH / 2 - MAP_MARGIN) / extent((v) => v.x, MIN_EXTENT_X), (MAP_HEIGHT / 2 - MAP_MARGIN) / extent((v) => v.y, MIN_EXTENT_Y));
}

/** Position sur le dessin, le nord en haut et le village choisi au centre. */
export const mapPoint = (village: MapVillage, origin: MapVillage, scale: number): { x: number; y: number } => ({
  x: MAP_WIDTH / 2 + (village.x - origin.x) * scale,
  y: MAP_HEIGHT / 2 - (village.y - origin.y) * scale,
});

export interface NearbyVillage {
  village: MapVillage;
  /** Distance en km, arrondie au 0,5 comme dans « Retours ». */ distance: number;
}

/** Villages du plus proche au plus éloigné de `origin`, sans lui-même. */
export function rankByDistance(origin: MapVillage, villages: readonly MapVillage[]): NearbyVillage[] {
  return villages
    .filter((v) => v.name !== origin.name)
    .map((village) => ({ village, distance: computeDistance('coords', null, village, origin) }))
    .sort((a, b) => a.distance - b.distance || a.village.kage.localeCompare(b.village.kage, 'fr'));
}

export interface MapView {
  zoom: number;
  panX: number;
  panY: number;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
/** Grossissement réel du dessin à 100 % : la vue s'ouvre resserrée autour du village au centre. */
const BASE_ZOOM = 2.1;

export const realZoom = (zoom: number): number => zoom * BASE_ZOOM;

/** Change le zoom en gardant fixe le point visé (`nx`, `ny` : sa position dans le cadre, de 0 à 1). Au minimum, la carte se recentre. */
export function zoomView(view: MapView, next: number, nx = 0.5, ny = 0.5): MapView {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (zoom === ZOOM_MIN) return { zoom, panX: 0, panY: 0 };
  const shrink = 1 / realZoom(view.zoom) - 1 / realZoom(zoom);
  return { zoom, panX: view.panX + (nx - 0.5) * shrink * MAP_WIDTH, panY: view.panY + (ny - 0.5) * shrink * MAP_HEIGHT };
}

export const viewBox = ({ zoom, panX, panY }: MapView): string => {
  const [width, height] = [MAP_WIDTH / realZoom(zoom), MAP_HEIGHT / realZoom(zoom)];
  return `${MAP_WIDTH / 2 + panX - width / 2} ${MAP_HEIGHT / 2 + panY - height / 2} ${width} ${height}`;
};
