import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelOfCommand, levelsSummary, parseAllLevels, parseOneLevel } from './member-levels.js';

describe('niveaux d’un membre', () => {
  it('lit les 6 niveaux dans l’ordre, « ? » pour ne pas changer', () => {
    assert.deepEqual(parseAllLevels(['11', '8', '8', '5', '7', '3']), { levels: { ce: 11, academy: 8, chunnin: 8, jounin: 5, wall: 7, hospital: 3 } });
    assert.deepEqual(parseAllLevels(['12', '?', '8', '?', '?', '0']), { levels: { ce: 12, chunnin: 8, hospital: 0 } });
  });

  it('refuse un nombre de niveaux ou un niveau incorrect', () => {
    assert.ok('error' in parseAllLevels(['11', '8']));
    assert.ok('error' in parseAllLevels(['11', '8', '8', '5', '7', '25']));
  });

  it('reconnaît les commandes individuelles, accents et variantes compris', () => {
    assert.equal(levelOfCommand('!monCE'), 'ce');
    assert.equal(levelOfCommand('!monAcadémie'), 'academy');
    assert.equal(levelOfCommand('!monChuunin'), 'chunnin');
    assert.equal(levelOfCommand('!monhopital'), 'hospital');
    assert.equal(levelOfCommand('!monMur'), 'wall');
    assert.equal(levelOfCommand('!monVillage'), null);
    assert.equal(parseOneLevel('9'), 9);
    assert.equal(parseOneLevel('neuf'), null);
  });

  it('résume les niveaux connus', () => {
    assert.equal(levelsSummary({ ce: 11, wall: 7 }), 'CE 11 · Académie ? · Centre Chunin ? · Centre Jounin ? · Mur 7 · Hôpital ?');
  });
});
