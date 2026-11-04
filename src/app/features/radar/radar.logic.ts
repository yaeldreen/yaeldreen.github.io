import { MapVillage } from '../../core/game-data/map-villages';
import { NO_CLAN, OWN_CLAN } from '../enemies/clans.data';

export const NEUTRAL_GROUP = 'Villages neutres';
const NEUTRAL_COLOR = '#3ce3b2';
const OWN_COLOR = '#77afff';
const NO_CLAN_COLOR = '#b7b0a5';
const PALETTE = ['#f59e78', '#d4a5ff', '#ffb46c', '#f07a9d', '#9ecae7', '#b4cf76', '#e9c46a', '#c6a0e9', '#e48faf'];

/** Taille de la carte en unités du dessin, et marge laissée autour du centre. */
export const MAP_SIZE = 600;
const MAP_REACH = 278;
/** Portée minimale, pour ne pas tout grossir quand peu de villages sont affichés. */
const MIN_EXTENT = 10;

export interface RadarGroup {
  name: string;
  count: number;
  color: string;
}

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
    .map((name) => ({ name, count: counts.get(name) ?? 0, color: color(name, clans.indexOf(name)) }));
}

/** Échelle du dessin : la carte étant carrée, seul le plus grand écart en x ou en y doit tenir dans le cadre. */
export function mapScale(origin: MapVillage, visible: readonly MapVillage[]): number {
  const farthest = Math.max(0, ...visible.flatMap((v) => [Math.abs(v.x - origin.x), Math.abs(v.y - origin.y)]));
  return MAP_REACH / Math.max(MIN_EXTENT, farthest + 1);
}

/** Position sur le dessin, le nord en haut et le village choisi au centre. */
export const mapPoint = (village: MapVillage, origin: MapVillage, scale: number): { x: number; y: number } => ({
  x: MAP_SIZE / 2 + (village.x - origin.x) * scale,
  y: MAP_SIZE / 2 - (village.y - origin.y) * scale,
});

export interface MapView {
  zoom: number;
  panX: number;
  panY: number;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

/** Change le zoom en gardant fixe le point visé (`nx`, `ny` : sa position dans le cadre, de 0 à 1). */
export function zoomView(view: MapView, next: number, nx = 0.5, ny = 0.5): MapView {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  if (zoom === ZOOM_MIN) return { zoom, panX: 0, panY: 0 };
  const shrink = MAP_SIZE / view.zoom - MAP_SIZE / zoom;
  return { zoom, panX: view.panX + (nx - 0.5) * shrink, panY: view.panY + (ny - 0.5) * shrink };
}

export const viewBox = ({ zoom, panX, panY }: MapView): string => {
  const size = MAP_SIZE / zoom;
  return `${MAP_SIZE / 2 + panX - size / 2} ${MAP_SIZE / 2 + panY - size / 2} ${size} ${size}`;
};
