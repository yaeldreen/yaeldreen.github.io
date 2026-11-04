import { clanVillages, computeReturnRows, secondsPerKm, ticketSecondsPerKm, travelMs } from './travel.logic';

describe('temps de trajet', () => {
  it('retire le bonus du CE aux 208 s de base, sans arrondi (CE 11 : 208 × 0,45 = 93,6 s)', () => {
    expect(secondsPerKm(11)).toBeCloseTo(93.6);
    expect(secondsPerKm(1)).toBeCloseTo(197.6);
    expect(secondsPerKm(20)).toBe(5);
  });

  it('sans ticket : arrondit le trajet à la seconde', () => {
    expect(travelMs(38.5, 11)).toBe(3_604_000);
  });

  it('ticket vitesse : CE 12 à 41,5 s / km, CE 13 à 36,5 s / km', () => {
    expect(ticketSecondsPerKm(12)).toBe(41.5);
    expect(ticketSecondsPerKm(13)).toBe(36.5);
  });

  it('ticket vitesse : retrouve les trajets observés', () => {
    expect(travelMs(7.5, 4, true)).toBe((10 * 60 + 27) * 1000);
    expect(travelMs(38.5, 11, true)).toBe((30 * 60 + 10) * 1000);
  });

  it('affiche un temps par km propre, sans erreur d’arrondi (CE 7 : 135,2 s)', () => {
    expect(computeReturnRows(1, 0, { level: 11, distanceKm: 0, nowMs: 0 })[6].speedPerKm).toBe('02:15,20');
  });

  it('applique le ticket dans le tableau des retours', () => {
    const row = computeReturnRows(38.5, 0, { level: 11, distanceKm: 0, nowMs: 0 })[10];
    expect(row.level).toBe(11);
    expect(row.speedPerKm).toBe('01:33,60');
    expect(row.marginMs).toBe(3_604_000);
    expect(row.ticketMarginMs).toBe(1_810_000);
    expect(row.ticketSpeedPerKm).toBe('47 s/km');
  });
});

describe('clanVillages', () => {
  const village = (name: string) => ({ name, kage: name, x: 1, y: 1, clan: null, points: 0, inhabitants: 0, neutral: false });
  const players = [
    { name: 'B', village: 'B', clan: 'Tsukuyomi' },
    { name: 'A', village: 'A', clan: 'Tsukuyomi' },
    { name: 'C', village: 'C', clan: 'Akatsuki' },
    { name: 'Absent', village: 'Absent', clan: 'Tsukuyomi' },
  ];

  it('garde les membres de notre clan présents sur la carte, triés par joueur', () => {
    expect(clanVillages(players, [village('A'), village('B'), village('C')]).map((v) => v.name)).toEqual(['A', 'B']);
  });
});
