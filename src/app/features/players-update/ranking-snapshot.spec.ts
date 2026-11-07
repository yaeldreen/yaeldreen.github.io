import { compareSnapshots, placeRanking, PlayersSnapshot, snapshotFromRanking, sortEvolution, toggleSort } from './ranking-snapshot';

const now = new Date(2026, 10, 7, 14, 32);
describe('relevé du classement', () => {
  const ranking = [
    { gameId: 80, name: 'Gwent', kage: 'Karadoc', clan: 'Kaamelott', points: 9398, inhabitants: 442 },
    { name: 'Loin', kage: 'Seul', clan: null, points: 10, inhabitants: 20 },
  ];

  it('reprend chaque joueur collé, avec la date du collage', () => {
    expect(snapshotFromRanking(ranking, now)).toEqual({
      month: '2026-11',
      takenAt: now.toISOString(),
      players: [
        { i: 80, n: 'Karadoc', v: 'Gwent', c: 'Kaamelott', p: 9398, h: 442 },
        { n: 'Seul', v: 'Loin', c: null, p: 10, h: 20 },
      ],
    });
  });

  it('commence un nouveau relevé sans relevé récent', () => {
    expect(placeRanking(null, ranking, now).rotate).toBe(true);
    const old = snapshotFromRanking(ranking, new Date(now.getTime() - 31 * 60_000));
    expect(placeRanking(old, ranking, now)).toMatchObject({ rotate: true, snapshot: { takenAt: now.toISOString() } });
  });

  it('complète le relevé en cours avec une autre page collée peu après', () => {
    const current = snapshotFromRanking(ranking, new Date(now.getTime() - 5 * 60_000));
    const page2 = [{ gameId: 80, name: 'Gwent', kage: 'Karadoc', clan: 'Kaamelott', points: 9400, inhabitants: 443 }, { gameId: 7, name: 'Neuf', kage: 'Nouveau', clan: null, points: 1, inhabitants: 2 }];
    const { snapshot, rotate } = placeRanking(current, page2, now);
    expect(rotate).toBe(false);
    expect(snapshot.takenAt).toBe(current.takenAt);
    expect(snapshot.players.map((p) => [p.n, p.p])).toEqual([['Seul', 10], ['Karadoc', 9400], ['Nouveau', 1]]);
  });
});

describe('compareSnapshots', () => {
  const snapshot = (players: PlayersSnapshot['players']): PlayersSnapshot => ({ month: '2026-11', takenAt: '', players });

  it('retrouve le joueur par son identifiant, même renommé, sinon par son nom', () => {
    const previous = snapshot([{ i: 80, n: 'Ancien nom', c: null, p: 9000, h: 420 }, { n: 'Sans id', c: null, p: 5, h: 5 }]);
    const current = snapshot([{ i: 80, n: 'Perceval', v: 'Tard', c: 'Kaamelott', p: 9069, h: 430 }, { i: 7, n: 'Sans id', c: null, p: 8, h: 5 }, { i: 9, n: 'Nouveau', c: null, p: 1, h: 1 }]);
    const rows = compareSnapshots(previous, current);
    expect(rows[0]).toMatchObject({ name: 'Perceval', village: 'Tard', previousPoints: 9000, pointsDelta: 69, inhabitantsDelta: 10 });
    expect(rows[1]).toMatchObject({ previousPoints: 5, village: null });
    expect(rows[2]).toMatchObject({ previousPoints: null, pointsDelta: null });
  });
});

describe('tri du tableau', () => {
  const rows = compareSnapshots(null, {
    month: '2026-11',
    takenAt: '',
    players: [
      { n: 'B', c: null, p: 10, h: 300 },
      { n: 'A', c: null, p: 10, h: 100 },
      { n: 'C', c: null, p: 50, h: 200 },
    ],
  });

  it('trie par points ou habitants actuels, à égalité par nom', () => {
    expect(sortEvolution(rows, { key: 'points', direction: 'desc' }).map((r) => r.name)).toEqual(['C', 'A', 'B']);
    expect(sortEvolution(rows, { key: 'inhabitants', direction: 'asc' }).map((r) => r.name)).toEqual(['A', 'C', 'B']);
  });

  it('change de sens sur la même colonne, part du plus grand sur une autre', () => {
    expect(toggleSort({ key: 'points', direction: 'desc' }, 'points')).toEqual({ key: 'points', direction: 'asc' });
    expect(toggleSort({ key: 'points', direction: 'asc' }, 'inhabitants')).toEqual({ key: 'inhabitants', direction: 'desc' });
  });
});
