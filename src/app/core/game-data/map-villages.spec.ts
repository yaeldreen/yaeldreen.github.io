import { findVillage, parseMapExport } from './map-villages';

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
