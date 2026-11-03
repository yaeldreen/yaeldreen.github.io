import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ImportedVillage } from './map-import.js';
import { buildSnapshot, compareSnapshots, isSnapshotDue, monthKey, monthLabel } from './monthly-snapshot.js';

const village = (kage: string, points: number, inhabitants: number, neutral = false): ImportedVillage => ({
  name: `${kage} city`, kage, x: 0, y: 0, clan: neutral ? null : 'Tsukuyomi', points, inhabitants, neutral,
});

describe('relevé mensuel', () => {
  it('se fait le 1er du mois à Paris, une seule fois', () => {
    const first = new Date(Date.UTC(2026, 10, 1, 8)); // 1er novembre, 9 h à Paris
    assert.equal(isSnapshotDue(first, null), true);
    assert.equal(isSnapshotDue(first, { month: '2026-10', takenAt: '', players: [] }), true);
    assert.equal(isSnapshotDue(first, { month: '2026-11', takenAt: '', players: [] }), false);
    // 31 octobre 23 h 30 UTC = déjà le 1er novembre à Paris.
    assert.equal(isSnapshotDue(new Date(Date.UTC(2026, 9, 31, 23, 30)), null), true);
    assert.equal(isSnapshotDue(new Date(Date.UTC(2026, 10, 2, 8)), null), false);
  });

  it('nomme le mois', () => {
    assert.equal(monthKey(new Date(Date.UTC(2026, 10, 1, 8))), '2026-11');
    assert.equal(monthLabel('2026-11'), '1er novembre 2026');
  });

  it('compare au mois précédent', () => {
    const previous = buildSnapshot([village('Tard', 2000, 380)], new Date(Date.UTC(2026, 9, 1, 8)));
    const current = buildSnapshot([village('Tard', 2361, 410), village('Nouveau', 50, 20), village('Yui', 0, 0, true)], new Date(Date.UTC(2026, 10, 1, 8)));
    assert.equal(current.players.length, 2);
    const rows = compareSnapshots(previous, current);
    assert.deepEqual([rows.find((r) => r.name === 'Tard')?.pointsDelta, rows.find((r) => r.name === 'Nouveau')?.pointsDelta], [361, null]);
  });
});
