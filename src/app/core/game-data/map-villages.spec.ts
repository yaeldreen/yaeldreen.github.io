import { applyCoordinates, findVillage, mergeRanking, parseCompactExport, parseMapExport, parseRankingExport, playersMissingFromCarte } from './map-villages';

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

  it('préfère le nom exact quand deux villages ne diffèrent que par les accents', () => {
    const entries = [{ name: 'Sparta', kage: 'A' }, { name: 'SPÄRTÄ', kage: 'B' }].map((v) => ({ ...v, x: 0, y: 0, clan: null, points: 0, inhabitants: 0, neutral: false }));
    expect(findVillage(entries, 'SPÄRTÄ')?.kage).toBe('B');
    expect(findVillage(entries, 'sparta')?.kage).toBe('A');
  });

  it('retrouve un village par son nom ou son joueur', () => {
    const villages = parseMapExport(EXPORT);
    expect(findVillage(villages, 'tard')?.kage).toBe('Serpent');
    expect(findVillage(villages, 'Serpent')?.name).toBe('Tard');
  });
});

describe('classement sans coordonnées', () => {
  const RANKING = JSON.stringify([
    { id: 80, name: 'Tard', kage: 'Serpent', points: 9059, clan: { id: 8, name: 'Tsukuyomi' }, rank: 9, inhabitants: 430 },
    { id: 142, name: 'Lymbes', kage: 'Hadès', points: 3969, clan: null, rank: 25, inhabitants: 256 },
  ]);

  it('lit le classement', () => {
    expect(parseRankingExport(RANKING)?.[1]).toEqual({ name: 'Lymbes', kage: 'Hadès', clan: null, points: 3969, inhabitants: 256 });
  });

  it('laisse l’export de la carte à son propre import', () => {
    expect(parseRankingExport(EXPORT)).toBeNull();
    expect(parseRankingExport('[ { coupé')).toBeNull();
  });

  it('refuse une ligne illisible', () => {
    expect(() => parseRankingExport('[{ "name": "Tard" }]')).toThrow(/Joueur n°1/);
  });

  it('garde les coordonnées et signale les joueurs absents de la carte', () => {
    const { villages, unknown } = mergeRanking(parseMapExport(EXPORT), parseRankingExport(RANKING)!);
    expect(villages).toEqual([{ name: 'Tard', kage: 'Serpent', x: 8199, y: -11, clan: 'Tsukuyomi', points: 9059, inhabitants: 430, neutral: false }]);
    expect(unknown).toEqual(['Hadès']);
  });

  it('signale un joueur connu mais sans coordonnées', () => {
    const offMap = [{ name: 'Tard', kage: 'Serpent', clan: null, points: 0, inhabitants: 0, neutral: false }];
    expect(mergeRanking(offMap, parseRankingExport(RANKING)!).unknown).toContain('Serpent');
  });

  it('retrouve par le joueur un village renommé, jamais un village neutre', () => {
    const map = parseMapExport(EXPORT);
    const renamed = [{ name: 'Nouveau', kage: 'Serpent', clan: 'Tsukuyomi', points: 1, inhabitants: 1 }];
    expect(mergeRanking(map, renamed).villages[0]).toMatchObject({ name: 'Nouveau', x: 8199 });
    const neutral = [{ name: 'Yuuno', kage: 'Autre', clan: null, points: 1, inhabitants: 1 }];
    expect(mergeRanking(map, neutral).unknown).toEqual(['Autre']);
  });
});

describe('parseCompactExport', () => {
  const COMPACT = `[
  { 0: 70, 1: "Memen", 2: "Maaminou", 3: "feu", 4: 8216, 5: 10, 6: 429, 7: 7502, 8: null, 9: false },
  { 0: -71, 1: "Hisatsuki", 2: "Yui Hisatsuki", 3: "feu", 4: 8126, 5: 5, 6: 0, 7: 12, 8: null, 9: true },
]`;

  it('sépare les villages neutres des joueurs, 6 = habitants et 7 = points', () => {
    expect(parseCompactExport(COMPACT)).toEqual({
      neutral: [{ name: 'Hisatsuki', kage: 'Yui Hisatsuki', x: 8126, y: 5, clan: null, points: 12, inhabitants: 0, neutral: true }],
      players: [{ name: 'Memen', kage: 'Maaminou', x: 8216, y: 10, clan: null, points: 7502, inhabitants: 429, neutral: false }],
    });
  });

  it('lit les lignes en tableaux, avec le clan', () => {
    const rows = [
      [70, 'Memen', 'Maaminou', 'feu', 8216, 10, 429, 7695, { id: 6, name: 'Shi no Kitzu', logo: '/api/clan-assets?id=28' }, false],
      [-75, 'Yuuno', 'Hinata Yuuno', 'feu', 8204, -10, 0, 0, null, true],
    ];
    expect(parseCompactExport(JSON.stringify(rows, null, 2))).toEqual({
      neutral: [{ name: 'Yuuno', kage: 'Hinata Yuuno', x: 8204, y: -10, clan: null, points: 0, inhabitants: 0, neutral: true }],
      players: [{ name: 'Memen', kage: 'Maaminou', x: 8216, y: 10, clan: 'Shi no Kitzu', points: 7695, inhabitants: 429, neutral: false }],
    });
  });

  it('accepte aussi des clés entre guillemets', () => {
    expect(parseCompactExport(JSON.stringify([{ 1: 'A', 2: 'B', 4: 1, 5: 2, 9: true }])).neutral[0].name).toBe('A');
  });

  it('refuse un export coupé ou une ligne illisible', () => {
    expect(() => parseCompactExport(COMPACT.slice(0, 60))).toThrow(/lisible/);
    expect(() => parseCompactExport('[{ 1: "A", 9: false }]')).toThrow(/Village n°1/);
  });
});

describe('applyCoordinates', () => {
  const map = parseMapExport(EXPORT);
  const entry = { name: 'Tard', kage: 'Serpent', x: 1, y: 2, clan: null, points: 5, inhabitants: 6, neutral: false };

  it('ne change que les coordonnées d’un village connu, et garde ses notes', () => {
    const known = map.map((v) => (v.kage === 'Serpent' ? { ...v, ce: 12 } : v));
    expect(applyCoordinates(known, [entry])).toEqual([{ ...entry, clan: 'Tsukuyomi', points: 2361, inhabitants: 410, ce: 12 }]);
  });

  it('retrouve par le joueur un village renommé', () => {
    expect(applyCoordinates(map, [{ ...entry, name: 'Nouveau' }])[0]).toMatchObject({ name: 'Nouveau', clan: 'Tsukuyomi', x: 1 });
  });

  it('place sur la carte un joueur ajouté à la main', () => {
    const offMap = [{ name: 'Tard', kage: 'Serpent', clan: 'Palace', points: 1, inhabitants: 2, neutral: false, ce: 3 }];
    expect(applyCoordinates(offMap, [entry])[0]).toMatchObject({ x: 1, y: 2, clan: 'Palace', ce: 3 });
  });

  it('ajoute un village inconnu avec le clan de l’export', () => {
    const fresh = { ...entry, name: 'Neuf', kage: 'Bob', clan: 'Palace' };
    expect(applyCoordinates(map, [fresh])).toEqual([fresh]);
  });

  it('ne confond pas deux villages qui ne diffèrent que par les accents', () => {
    const sparta = { ...entry, name: 'Sparta', kage: 'CafardTueur', x: 8165, y: -7, points: 0 };
    const accents = { ...entry, name: 'SPÄRTÄ', kage: 'CÄFÄRDTUEUR', x: 8191, y: -3, points: 47 };
    expect(applyCoordinates([sparta, accents], [{ ...accents, x: 1, points: 64 }])[0]).toMatchObject({ name: 'SPÄRTÄ', x: 1, points: 47 });
  });
});

describe('playersMissingFromCarte', () => {
  const carte = parseMapExport(EXPORT);

  it('garde un joueur présent, même renommé ou changé de village', () => {
    expect(playersMissingFromCarte([{ name: 'serpent', village: 'Ailleurs' }, { name: 'Ancien nom', village: 'TARD' }], carte)).toEqual([]);
  });

  it('retourne le joueur absent de la liste', () => {
    const gone = { name: 'Ei Sei', village: 'Qin' };
    expect(playersMissingFromCarte([gone, { name: 'Serpent', village: 'Tard' }], carte)).toEqual([gone]);
  });
});
