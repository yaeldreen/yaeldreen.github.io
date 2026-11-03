import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapVillage } from '../game-data.js';
import { searchVillages } from './pick-village.js';

const v = (name: string, kage: string): MapVillage => ({ name, kage, x: 0, y: 0, clan: null, neutral: false });
const villages = [v('Malice at the pa', 'Pacers'), v('Matelland', 'Abimaru'), v('Leaf village', 'Asuma'), v('Ninjed', 'Jued')];

describe('recherche de village', () => {
  it('propose ceux qui commencent par le texte, puis ceux qui le contiennent', () => {
    // « ma » commence Malice et Matelland, et se trouve dans Asuma (joueur de Leaf village), proposé après.
    assert.deepEqual(searchVillages(villages, 'ma').map((x) => x.name), ['Malice at the pa', 'Matelland', 'Leaf village']);
    assert.deepEqual(searchVillages(villages, 'vill').map((x) => x.name), ['Leaf village']);
  });

  it('trouve aussi par le nom du joueur, sans accents ni majuscules', () => {
    assert.deepEqual(searchVillages(villages, 'PACERS').map((x) => x.name), ['Malice at the pa']);
  });

  it('ne renvoie rien pour une recherche vide', () => {
    assert.deepEqual(searchVillages(villages, '  '), []);
  });
});
