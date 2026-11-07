import { MapVillage } from '../../core/game-data/map-villages';
import { gameLinks, planHash, MAP_HEIGHT, MAP_WIDTH, mapPoint, mapScale, NEUTRAL_GROUP, radarGroups, rankByDistance, realZoom, viewBox, zoomView } from './radar.logic';

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
    // La forme distingue les groupes sans compter sur la couleur.
    expect(groups.map((g) => g.shape)).toEqual(['square', 'triangle', 'circle', 'circle', 'ring']);
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
    expect(mapPoint(origin, origin, 10)).toEqual({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
    expect(mapPoint(village('Nord-est', 8201, 2), origin, 10)).toEqual({ x: 310, y: 130 });
  });

  it('garde le plus éloigné dans le cadre, en largeur comme en hauteur', () => {
    for (const far of [village('Est', 8260, 0), village('Nord', 8200, 40), village('Coin', 8230, -30)]) {
      const point = mapPoint(far, origin, mapScale(origin, [far]));
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(MAP_WIDTH);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(MAP_HEIGHT);
    }
  });

  it('ouvre à 100 % une vue grossie 2,1 fois, centrée', () => {
    expect(realZoom(1)).toBe(2.1);
    const [x, y, width, height] = viewBox({ zoom: 1, panX: 0, panY: 0 }).split(' ').map(Number);
    expect(width).toBeCloseTo(MAP_WIDTH / 2.1);
    expect(x + width / 2).toBeCloseTo(MAP_WIDTH / 2);
    expect(y + height / 2).toBeCloseTo(MAP_HEIGHT / 2);
  });

  it('borne le zoom de 50 à 300 %, et recentre au minimum', () => {
    expect(zoomView({ zoom: 1, panX: 40, panY: 40 }, 0.1)).toEqual({ zoom: 0.5, panX: 0, panY: 0 });
    expect(zoomView({ zoom: 1, panX: 0, panY: 0 }, 50).zoom).toBe(3);
  });

  it('garde fixe le point visé en zoomant', () => {
    const before = { zoom: 1, panX: 0, panY: 0 };
    const edge = (view: typeof before) => {
      const [x, , width] = viewBox(view).split(' ').map(Number);
      return x + width;
    };
    expect(edge(zoomView(before, 1.5, 1, 0.5))).toBeCloseTo(edge(before));
  });
});

describe('rankByDistance', () => {
  it('classe du plus proche au plus éloigné, sans le village visé', () => {
    const target = village('Cible', 0, 0);
    const others = [village('Loin', 30, 40), village('Proche', 3, 4), village('Cible', 0, 0), village('Moyen', 6, 8)];
    expect(rankByDistance(target, others).map((m) => [m.village.name, m.distance])).toEqual([
      ['Proche', 5],
      ['Moyen', 10],
      ['Loin', 50],
    ]);
  });
});

describe('gameLinks', () => {
  const plan = { genin: 1, chuunin: 0, jounin: 2, mode: 'pillage' as const };

  it('donne village, profil et attaque préremplie pour un joueur', () => {
    expect(gameLinks({ ...village('Memen', 0, 0, 'Palace'), gameId: 70 }, plan).map((l) => [l.label, l.url])).toEqual([
      ['Village', 'https://worldofshinobi.com/joueur.html?id=70'],
      ['Profil', 'https://worldofshinobi.com/profil.html?id=70'],
      ['Attaque', 'https://worldofshinobi.com/attaque.html?id=70#radar=1,0,2,pillage'],
    ]);
  });

  it('donne un soutien sans préremplissage pour un membre de notre clan', () => {
    const links = gameLinks({ ...village('Tard', 0, 0, 'Tsukuyomi'), gameId: 80 }, plan);
    expect(links.map((l) => l.label)).toEqual(['Village', 'Profil', 'Soutien']);
    expect(links[2].url).toBe('https://worldofshinobi.com/attaque.html?id=80&mode=support');
  });

  it('donne seulement l’attaque préremplie pour un village neutre', () => {
    expect(gameLinks({ ...village('Yuuno', 0, 0, null, true), gameId: -75 }, { ...plan, mode: 'combat' }).map((l) => [l.label, l.url])).toEqual([
      ['Attaque', 'https://worldofshinobi.com/attaque.html?id=-75#radar=1,0,2,combat'],
    ]);
  });

  it('ne transmet rien au script sans réglage de préremplissage', () => {
    expect(gameLinks({ ...village('Memen', 0, 0, 'Palace'), gameId: 70 })[2].url).toBe('https://worldofshinobi.com/attaque.html?id=70');
    expect(gameLinks({ ...village('Yuuno', 0, 0, null, true), gameId: -75 })[0].url).toBe('https://worldofshinobi.com/attaque.html?id=-75');
  });

  it('ramène les quantités vides ou invalides à 0', () => {
    expect(planHash({ genin: null, chuunin: -3, jounin: 2.9, mode: 'pillage' })).toBe('#radar=0,0,2,pillage');
  });

  it('n’invente pas de lien sans identifiant', () => {
    expect(gameLinks(village('Inconnu', 0, 0))).toEqual([]);
  });
});
