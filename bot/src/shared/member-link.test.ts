import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchPlayer } from './member-link.js';

const players = [
  { name: 'Serpent', village: 'Tard', clan: 'Tsukuyomi' },
  { name: 'Abimaru', village: 'Matelland', clan: 'Tsukuyomi' },
  { name: 'Konan', village: 'Yume', clan: 'Kuro No Kishidan' },
  { name: 'Tard', village: 'Ailleurs', clan: 'Autre' },
];

describe('liaison membre Discord ↔ joueur', () => {
  it('reconnaît le pseudo (nom du joueur ou du village), sans accents, majuscules ni émojis', () => {
    assert.equal(matchPlayer(['🐍 SERPENT'], players, 'Tsukuyomi')?.village, 'Tard');
    assert.equal(matchPlayer([null, 'matelland'], players, 'Tsukuyomi')?.name, 'Abimaru');
  });

  it('préfère le membre du clan en cas de doublon', () => {
    assert.equal(matchPlayer(['Tard'], players, 'Tsukuyomi')?.name, 'Serpent');
  });

  it('ne devine pas quand rien ne correspond', () => {
    assert.equal(matchPlayer(['Nico ✨', 'nico_42'], players, 'Tsukuyomi'), null);
  });
});
