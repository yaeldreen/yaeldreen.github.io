import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lookupPlayer } from '../game-data.js';

const players = [
  { name: 'Pacers', village: 'Malice at the pa' },
  { name: 'Konan', village: 'Yume' },
  { name: 'Konoha', village: 'Feuille' },
];

describe('recherche d’un joueur', () => {
  it('trouve le nom ou le village exact, sans accents ni majuscules', () => {
    assert.equal(lookupPlayer(players, 'YUME')?.name, 'Konan');
    assert.equal(lookupPlayer(players, 'pacers')?.name, 'Pacers');
  });

  it('trouve le seul qui commence par, puis le seul qui contient le texte', () => {
    assert.equal(lookupPlayer(players, 'malice')?.name, 'Pacers');
    assert.equal(lookupPlayer(players, 'at the')?.name, 'Pacers');
  });

  it('ne devine pas quand plusieurs correspondent', () => {
    assert.equal(lookupPlayer(players, 'kon'), null);
  });
});
