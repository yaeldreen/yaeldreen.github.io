import { MapVillage } from '../../core/game-data/map-villages';
import { buildSnapshot, compareSnapshots, isSnapshotDue, monthKey, monthLabel } from './monthly-snapshot';

const village = (kage: string, points: number, inhabitants: number, neutral = false): MapVillage => ({
  name: `${kage} city`,
  kage,
  x: 0,
  y: 0,
  clan: neutral ? null : 'Tsukuyomi',
  points,
  inhabitants,
  neutral,
});

describe('relevé mensuel', () => {
  it('se fait le 1er du mois, une seule fois', () => {
    const first = new Date(2026, 10, 1, 9);
    expect(isSnapshotDue(first, null)).toBe(true);
    expect(isSnapshotDue(first, { month: '2026-10', takenAt: '', players: [] })).toBe(true);
    expect(isSnapshotDue(first, { month: '2026-11', takenAt: '', players: [] })).toBe(false);
    expect(isSnapshotDue(new Date(2026, 10, 2), null)).toBe(false);
  });

  it('nomme le mois', () => {
    expect(monthKey(new Date(2026, 10, 1))).toBe('2026-11');
    expect(monthLabel('2026-11')).toBe('1er novembre 2026');
  });

  it('garde les joueurs de la carte, sans les villages neutres', () => {
    const snapshot = buildSnapshot([village('Tard', 2361, 410), village('Yui', 0, 0, true)], new Date(2026, 10, 1));
    expect(snapshot.players).toEqual([{ n: 'Tard', c: 'Tsukuyomi', p: 2361, h: 410 }]);
  });

  it('compare au mois précédent', () => {
    const previous = buildSnapshot([village('Tard', 2000, 380)], new Date(2026, 9, 1));
    const current = buildSnapshot([village('Tard', 2361, 410), village('Nouveau', 50, 20)], new Date(2026, 10, 1));
    const rows = compareSnapshots(previous, current);
    expect(rows.find((r) => r.name === 'Tard')).toMatchObject({ pointsDelta: 361, inhabitantsDelta: 30, previousPoints: 2000 });
    expect(rows.find((r) => r.name === 'Nouveau')).toMatchObject({ pointsDelta: null, previousPoints: null });
  });
});
