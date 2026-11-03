import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Buildings } from '../build-guide/buildings.js';
import { fieldProduction, parseFieldLevels, timeSinceEmpty } from './production.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')) as { buildings: Buildings; production: { fieldCounts: Record<'stone' | 'wood' | 'iron' | 'food', number> } };
const { buildings } = json;
const counts = json.production.fieldCounts;
const at = Date.UTC(2026, 9, 29, 11, 0, 0);

describe('calcul seconde', () => {
  it('reprend la table de production du jeu', () => {
    assert.deepEqual([0, 1, 5, 15, 20].map((l) => fieldProduction(buildings, l)), [4, 25, 92, 1025, 2500]);
  });

  it('additionne les champs et en déduit le temps écoulé (2 champs niv. 5 : 92 ressources = 30 min)', () => {
    const t = timeSinceEmpty(buildings, [5, 5], 92, at);
    assert.equal(t.perHour, 184);
    assert.equal(t.elapsedSeconds, 1800);
    assert.equal(t.zeroAt, at - 1_800_000);
  });

  it('arrondit à la seconde, et ne calcule rien sans quantité', () => {
    assert.equal(timeSinceEmpty(buildings, [1, 1, 1], 1, at).elapsedSeconds, 48);
    assert.equal(timeSinceEmpty(buildings, [5, 5], null, at).elapsedSeconds, null);
  });

  it('lit les 9 niveaux de champs dans l’ordre pierre, bois, fer, nourriture', () => {
    assert.deepEqual(parseFieldLevels('5 5 4 4 6 6 3 3 3'.split(' '), counts), { stone: [5, 5], wood: [4, 4], iron: [6, 6], food: [3, 3, 3] });
    assert.ok('error' in parseFieldLevels(['5', '5'], counts));
    assert.ok('error' in parseFieldLevels('5 5 4 4 6 6 3 3 25'.split(' '), counts));
  });
});
