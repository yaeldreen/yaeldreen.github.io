import { findVillage, parseMapExport, parseNeutralExport } from './map-villages';

const EXPORT = JSON.stringify([
  { id: -75, name: 'Yuuno', kage: 'Hinata Yuuno', x: 8124, y: -1, neutral: true, clan: null, points: 0, inhabitants: 0 },
  { id: 80, name: 'Tard', kage: 'Serpent', x: 8199, y: -11, neutral: false, clan: { id: 8, name: 'Tsukuyomi' }, points: 2361, inhabitants: 410 },
]);

describe('parseMapExport', () => {
  it('lit les villages de l’export du jeu', () => {
    expect(parseMapExport(EXPORT)).toEqual([
      { name: 'Yuuno', kage: 'Hinata Yuuno', x: 8124, y: -1, clan: null, points: 0, inhabitants: 0, neutral: true },
      { name: 'Tard', kage: 'Serpent', x: 8199, y: -11, clan: 'Tsukuyomi', points: 2361, inhabitants: 410, neutral: false },
    ]);
  });

  it('refuse un export coupé', () => {
    expect(() => parseMapExport(EXPORT.slice(0, 80))).toThrow(/JSON valide/);
  });

  it('retrouve un village par son nom ou son joueur', () => {
    const villages = parseMapExport(EXPORT);
    expect(findVillage(villages, 'tard')?.kage).toBe('Serpent');
    expect(findVillage(villages, 'Serpent')?.name).toBe('Tard');
  });
});

describe('parseNeutralExport', () => {
  const COMPACT = `[
  { 0: 70, 1: "Memen", 2: "Maaminou", 3: "feu", 4: 8216, 5: 10, 6: 429, 7: 7502, 8: null, 9: false },
  { 0: -71, 1: "Hisatsuki", 2: "Yui Hisatsuki", 3: "feu", 4: 8126, 5: 5, 6: 0, 7: 12, 8: null, 9: true },
]`;

  it('ne garde que les villages neutres', () => {
    expect(parseNeutralExport(COMPACT)).toEqual([
      { name: 'Hisatsuki', kage: 'Yui Hisatsuki', x: 8126, y: 5, clan: null, points: 0, inhabitants: 12, neutral: true },
    ]);
  });

  it('accepte aussi des clés entre guillemets', () => {
    expect(parseNeutralExport(JSON.stringify([{ 1: 'A', 2: 'B', 4: 1, 5: 2, 9: true }]))[0].name).toBe('A');
  });

  it('refuse un export coupé', () => {
    expect(() => parseNeutralExport(COMPACT.slice(0, 60))).toThrow(/lisible/);
  });
});
