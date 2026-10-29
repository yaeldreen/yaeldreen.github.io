import { fieldProduction, timeSinceEmpty } from './production.logic';

describe('fieldProduction', () => {
  it('reprend la table du jeu', () => {
    expect([0, 1, 5, 15, 20].map(fieldProduction)).toEqual([4, 25, 92, 1025, 2500]);
  });
});

describe('timeSinceEmpty', () => {
  const at = new Date(2026, 9, 29, 12, 0, 0).getTime();

  it('additionne les champs et en déduit le temps écoulé', () => {
    // 2 champs niveau 5 : 184 / h → 92 ressources = 30 min.
    const timing = timeSinceEmpty([5, 5], 92, at);
    expect(timing.perHour).toBe(184);
    expect(timing.elapsedSeconds).toBe(1800);
    expect(timing.zeroAt).toBe(new Date(2026, 9, 29, 11, 30, 0).getTime());
  });

  it('arrondit à la seconde', () => {
    // 3 champs niveau 1 : 75 / h → 1 ressource = 48 s.
    expect(timeSinceEmpty([1, 1, 1], 1, at).elapsedSeconds).toBe(48);
  });

  it('ne calcule rien sans quantité saisie', () => {
    expect(timeSinceEmpty([5, 5], null, at).elapsedSeconds).toBeNull();
  });
});
