import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapVillage } from '../game-data.js';
import { clanVillages, rankClanMembers } from './nearest.js';

const v = (name: string, kage: string, x: number, y: number, clan: string | null = 'Tsukuyomi', neutral = false): MapVillage => ({ name, kage, x, y, clan, neutral });

describe('qui est le plus proche', () => {
  const map = [v('Tard', 'Serpent', 8199, -11), v('Matelland', 'Abimaru', 8180, -6), v('Jidou', 'Minimilk', 8199, 20, 'Kuro'), v('Yuki', 'Yui', 8181, -30, null, true)];
  const target = v('Reggaeton', 'Jakojak', 8222, -17, 'Yawata');

  it('ne garde que les villages du clan', () => {
    assert.deepEqual(clanVillages(map, 'Tsukuyomi').map((m) => m.name), ['Tard', 'Matelland']);
  });

  it('classe du plus proche au plus loin, au demi-km', () => {
    const ranked = rankClanMembers(target, clanVillages(map, 'Tsukuyomi'));
    assert.deepEqual(ranked.map((r) => [r.village.kage, r.distance]), [['Serpent', 24], ['Abimaru', 43.5]]);
  });

  it('exclut le village visé lui-même', () => {
    assert.deepEqual(rankClanMembers(map[0], clanVillages(map, 'Tsukuyomi')).map((r) => r.village.name), ['Matelland']);
  });
});
