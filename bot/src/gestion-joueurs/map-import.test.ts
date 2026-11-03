import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseMapExport, parseNeutralExport } from './map-import.js';

const EXPORT = JSON.stringify([
  { id: -75, name: 'Yuuno', kage: 'Hinata Yuuno', x: 8124, y: -1, neutral: true, clan: null, points: 0, inhabitants: 0 },
  { id: 80, name: 'Tard', kage: 'Serpent', x: 8199, y: -11, neutral: false, clan: { id: 8, name: 'Tsukuyomi' }, points: 2361, inhabitants: 410 },
]);

describe('export de la liste des joueurs', () => {
  it('lit les villages', () => {
    assert.deepEqual(parseMapExport(EXPORT), [
      { name: 'Yuuno', kage: 'Hinata Yuuno', x: 8124, y: -1, clan: null, points: 0, inhabitants: 0, neutral: true },
      { name: 'Tard', kage: 'Serpent', x: 8199, y: -11, clan: 'Tsukuyomi', points: 2361, inhabitants: 410, neutral: false },
    ]);
  });

  it('refuse un export coupé', () => {
    assert.throws(() => parseMapExport(EXPORT.slice(0, 80)), /JSON valide/);
  });
});

describe('export compact des villages neutres', () => {
  const COMPACT = `[
  { 0: 70, 1: "Memen", 2: "Maaminou", 3: "feu", 4: 8216, 5: 10, 6: 429, 7: 7502, 8: null, 9: false },
  { 0: -71, 1: "Hisatsuki", 2: "Yui Hisatsuki", 3: "feu", 4: 8126, 5: 5, 6: 0, 7: 12, 8: null, 9: true },
]`;

  it('ne garde que les villages neutres', () => {
    assert.deepEqual(parseNeutralExport(COMPACT), [
      { name: 'Hisatsuki', kage: 'Yui Hisatsuki', x: 8126, y: 5, clan: null, points: 0, inhabitants: 12, neutral: true },
    ]);
  });

  it('refuse un export coupé', () => {
    assert.throws(() => parseNeutralExport(COMPACT.slice(0, 60)), /lisible/);
  });
});
