import { MapVillage } from '../../core/game-data/map-villages';
import { clanVillages, playerVillages } from '../travel/travel.logic';
import { rankClanMembers } from './nearest.logic';

const village = (name: string, x: number, y: number): MapVillage => ({
  name,
  kage: name,
  x,
  y,
  clan: 'Tsukuyomi',
  points: 0,
  inhabitants: 0,
  neutral: false,
});

describe('rankClanMembers', () => {
  const target = village('Cible', 0, 0);
  const members = [village('Loin', 30, 40), village('Proche', 3, 4), village('Cible', 0, 0), village('Moyen', 6, 8)];

  it('classe du plus proche au plus éloigné, sans le village visé', () => {
    expect(rankClanMembers(target, members).map((m) => [m.village.name, m.distance])).toEqual([
      ['Proche', 5],
      ['Moyen', 10],
      ['Loin', 50],
    ]);
  });
});

describe('clanVillages', () => {
  const villages = [village('A', 1, 1), village('B', 2, 2), village('C', 3, 3)];
  const players = [
    { name: 'A', village: 'A', clan: 'Tsukuyomi' },
    { name: 'B', village: 'B', clan: 'Akatsuki' },
    { name: 'C', village: 'C', clan: null },
  ];

  it('prend notre clan par défaut', () => {
    expect(clanVillages(players, villages).map((v) => v.name)).toEqual(['A']);
  });

  it('peut prendre tous les joueurs, triés par nom', () => {
    expect(playerVillages(players, villages).map((v) => v.name)).toEqual(['A', 'B', 'C']);
  });

  it('filtre sur le clan choisi, ou les joueurs sans clan', () => {
    expect(clanVillages(players, villages, 'Akatsuki').map((v) => v.name)).toEqual(['B']);
    expect(clanVillages(players, villages, null).map((v) => v.name)).toEqual(['C']);
  });
});
