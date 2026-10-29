import { MapVillage } from '../../core/game-data/map-villages';
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
