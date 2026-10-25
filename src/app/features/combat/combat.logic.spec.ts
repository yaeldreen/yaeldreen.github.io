import { Army, sideStats, simulateCombat } from './combat.logic';

const army = (troops: [number, number, number], levels: Partial<Army['levels']>): Army => ({
  troops: { genin: troops[0], chuunin: troops[1], jounin: troops[2] },
  levels: { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0, ...levels },
});

describe('sideStats', () => {
  // Puissances affichées en jeu : CE 11, Académie 8, Centre Chuunin 8, Centre Jounin 1, Mur 1.
  const mine = army([0, 0, 0], { training: 11, academy: 8, chunnin: 8, jounin: 1, wall: 1 });

  it('retrouve la puissance d’attaque affichée (14 / 56 / 73)', () => {
    const { unitPower } = sideStats(mine, false);
    expect([unitPower.genin, unitPower.chuunin, unitPower.jounin].map(Math.round)).toEqual([14, 56, 73]);
  });

  it('ajoute le mur en défense (14 / 57 / 75)', () => {
    const { unitPower } = sideStats(mine, true);
    expect([unitPower.genin, unitPower.chuunin, unitPower.jounin].map(Math.round)).toEqual([14, 57, 75]);
  });
});

describe('simulateCombat', () => {
  // Rapport du 19/10 : Guerre (CE 5) attaque Matrice (CE 2, Mur 1), Académie / Chuunin 8 et Jounin 5 des deux côtés.
  const guerre = army([1108, 703, 114], { training: 5, academy: 8, chunnin: 8, jounin: 5 });
  const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 });

  it('retrouve les pertes et les points de l’assaillant', () => {
    const result = simulateCombat(guerre, matrice);
    expect(result.attackerWins).toBe(true);
    expect(result.attackerLosses).toEqual({ genin: 132, chuunin: 84, jounin: 14 });
    expect(result.defenderPoints).toBe(692);
  });

  it('encadre les pertes réelles du défenseur (381 / 227 / 29)', () => {
    const { defenderLosses, attackerPoints } = simulateCombat(guerre, matrice);
    expect(defenderLosses!.min.genin).toBeLessThanOrEqual(381);
    expect(defenderLosses!.max.genin).toBeGreaterThanOrEqual(381);
    expect(attackerPoints!.min).toBeLessThanOrEqual(1806);
    expect(attackerPoints!.max).toBeGreaterThanOrEqual(1806);
  });

  it('ne prédit pas les pertes du défenseur quand il est plus fort', () => {
    const result = simulateCombat(army([100, 0, 0], {}), army([1000, 0, 0], {}));
    expect(result.attackerWins).toBe(false);
    expect(result.attackerLossRate).toBe(1);
    expect(result.defenderLosses).toBeNull();
  });
});
