import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parisToMs } from '../shared/paris-time.js';
import { parseHistoryLines } from './history-line.js';

describe('ligne du journal d’attaques', () => {
  it('lit l’heure (Paris), l’assaillant et le défenseur', () => {
    assert.deepEqual(parseHistoryLines('03/11/2026 18:46 | Boboch a pillé Tombstone'), [
      { attackedAtMs: parisToMs({ year: 2026, month: 11, day: 3, hour: 18, minute: 46, second: 0 }), attacker: 'Boboch', defender: 'Tombstone', pillage: true },
    ]);
  });

  it('accepte plusieurs lignes, des noms avec espaces, et ignore le reste', () => {
    const lines = parseHistoryLines('Attaques du clan\n03/11/2026 18:46 | Leaf village a attaqué Malice at the pa\n  01/11/2026 9:05 | Konan a pillé Tard  ');
    assert.deepEqual(lines.map((l) => [l.attacker, l.defender, l.pillage]), [
      ['Leaf village', 'Malice at the pa', false],
      ['Konan', 'Tard', true],
    ]);
  });

  it('sépare des lignes collées bout à bout', () => {
    const lines = parseHistoryLines('03/11/2026 18:46 | Boboch a pillé Tombstone 03/11/2026 18:50 | Konan a attaqué Tard');
    assert.deepEqual(lines.map((l) => [l.attacker, l.defender]), [['Boboch', 'Tombstone'], ['Konan', 'Tard']]);
  });

  it('ignore une date impossible', () => {
    assert.deepEqual(parseHistoryLines('31/13/2026 18:46 | A a pillé B'), []);
  });
});
