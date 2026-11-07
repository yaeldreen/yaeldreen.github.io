import { compareSnapshots, PlayersSnapshot, RANKING_MESSAGE, readRankingMessage, sortEvolution, toggleSort } from './ranking-snapshot';

const now = new Date(2026, 10, 7, 14, 32);
const row = (id: number, kage: string, points: number, inhabitants: number, clan: string | null = 'Kaamelott') => ({
  rank: 1,
  id,
  kage,
  name: `${kage} city`,
  clan: clan ? { id: 8, name: clan } : null,
  points,
  inhabitants,
});

describe('readRankingMessage', () => {
  it('lit les joueurs du classement, avec la date du relevé', () => {
    const snapshot = readRankingMessage({ type: RANKING_MESSAGE, takenAt: now.toISOString(), players: [row(80, 'Serpent', 9069, 430), row(5, 'Seul', 10, 20, null)] }, new Date());
    expect(snapshot).toEqual({
      month: '2026-11',
      takenAt: now.toISOString(),
      players: [
        { i: 80, n: 'Serpent', v: 'Serpent city', c: 'Kaamelott', p: 9069, h: 430 },
        { i: 5, n: 'Seul', v: 'Seul city', c: null, p: 10, h: 20 },
      ],
    });
  });

  it('prend l’heure de réception si le script n’en donne pas', () => {
    expect(readRankingMessage({ type: RANKING_MESSAGE, players: [row(1, 'A', 1, 1)] }, now)?.takenAt).toBe(now.toISOString());
  });

  it('refuse un autre message, une liste vide ou un joueur illisible', () => {
    expect(readRankingMessage({ type: 'autre', players: [row(1, 'A', 1, 1)] }, now)).toBeNull();
    expect(readRankingMessage({ type: RANKING_MESSAGE, players: [] }, now)).toBeNull();
    expect(readRankingMessage({ type: RANKING_MESSAGE, players: [{ id: 1, points: 3 }] }, now)).toBeNull();
    expect(readRankingMessage('texte', now)).toBeNull();
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
