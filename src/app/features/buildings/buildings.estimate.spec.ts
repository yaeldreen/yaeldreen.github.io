import { estimateLevels } from './buildings.estimate';

describe('estimateLevels', () => {
  it('retrouve le profil calé avec le clan à 307 habitants (CE 11)', () => {
    const levels = estimateLevels(307);
    expect(levels.training).toBe(11);
    expect([levels.academy, levels.chunnin]).toEqual([8, 8]);
    expect([levels.mineStone, levels.reserve, levels.highCouncil, levels.raptor]).toEqual([3, 1, 1, 0]);
  });

  it('ne construit rien sans habitants', () => {
    expect(Object.values(estimateLevels(0)).every((l) => l === 0)).toBe(true);
  });

  it('progresse avec les habitants', () => {
    expect(estimateLevels(150).training).toBeLessThanOrEqual(estimateLevels(500).training);
  });
});
