import { MapVillage } from '../../core/game-data/map-villages';
import { MAP_SIZE, mapPoint, mapScale, NEUTRAL_GROUP, radarGroups, viewBox, zoomView } from './radar.logic';

const village = (name: string, x: number, y: number, clan: string | null = null, neutral = false): MapVillage => ({
  name,
  kage: name,
  x,
  y,
  clan,
  points: 0,
  inhabitants: 0,
  neutral,
});

describe('radarGroups', () => {
  it('range neutres, notre clan, les autres clans puis les sans clan, avec leur nombre', () => {
    const groups = radarGroups([village('A', 0, 0), village('B', 0, 0, 'Palace'), village('C', 0, 0, 'Tsukuyomi'), village('D', 0, 0, null, true), village('E', 0, 0, 'Akatsuki')]);
    expect(groups.map((g) => [g.name, g.count])).toEqual([[NEUTRAL_GROUP, 1], ['Tsukuyomi', 1], ['Akatsuki', 1], ['Palace', 1], ['Sans Clans', 1]]);
  });

  it('donne une couleur différente aux premiers clans, et ne garde que les groupes présents', () => {
    const groups = radarGroups([village('A', 0, 0, 'Palace'), village('B', 0, 0, 'Akatsuki')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].color).not.toBe(groups[1].color);
  });
});

describe('dessin de la carte', () => {
  const origin = village('Centre', 8200, 0);

  it('place le village choisi au centre et le nord en haut', () => {
    expect(mapPoint(origin, origin, 10)).toEqual({ x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
    expect(mapPoint(village('Nord-est', 8201, 2), origin, 10)).toEqual({ x: 310, y: 280 });
  });

  it('garde le plus éloigné dans le cadre', () => {
    const far = village('Loin', 8230, 40);
    const point = mapPoint(far, origin, mapScale(origin, [far]));
    expect(Math.max(Math.abs(point.x - 300), Math.abs(point.y - 300))).toBeLessThan(MAP_SIZE / 2);
  });

  it('remplit le cadre sur le plus grand écart, pas sur la diagonale', () => {
    expect(mapScale(origin, [village('Coin', 8230, 30)])).toBe(mapScale(origin, [village('Est', 8230, 0)]));
  });

  it('borne le zoom et recentre à 100 %', () => {
    expect(zoomView({ zoom: 2, panX: 40, panY: 40 }, 0.5)).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(zoomView({ zoom: 1, panX: 0, panY: 0 }, 50).zoom).toBe(8);
  });

  it('garde fixe le point visé en zoomant', () => {
    const before = { zoom: 1, panX: 0, panY: 0 };
    const after = zoomView(before, 2, 1, 0.5);
    const [x, , size] = viewBox(after).split(' ').map(Number);
    expect(x + size).toBe(MAP_SIZE);
  });
});
