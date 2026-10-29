import { Army, optimalAttack, rebuildMinutes, recoveryRate, sideStats, simulateCombat } from './combat.logic';

const army = (
  troops: [number, number, number],
  levels: Partial<Army['levels']>,
  hospitalTicket = false,
  combatTicket = false,
): Army => ({
  troops: { genin: troops[0], chuunin: troops[1], jounin: troops[2] },
  levels: { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0, hospital: 0, ...levels },
  hospitalTicket,
  combatTicket,
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

describe('ticket attaque / défense', () => {
  it('multiplie par 1,2 après les bonus (défense affichée 19 / 77 / 106)', () => {
    const levels = { training: 12, academy: 8, chunnin: 8, jounin: 6, wall: 7 };
    const { unitPower } = sideStats(army([0, 0, 0], levels, false, true), true);
    expect([unitPower.genin, unitPower.chuunin, unitPower.jounin].map(Math.round)).toEqual([19, 77, 106]);
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

  it('quand la défense est plus forte, retrouve le rapport Gogokage → Weedland (26/10)', () => {
    // Bonus inconnus : comparaison sans bonus. Réel : assaillant 900 / 527 / 74, défenseur 383 / 268 / 62.
    const result = simulateCombat(army([1922, 1125, 159], {}), army([2188, 1529, 353], {}));
    expect(result.attackerWins).toBe(false);
    const { genin, chuunin, jounin } = result.attackerLosses;
    expect(Math.abs(genin - 900)).toBeLessThanOrEqual(10);
    expect(Math.abs(chuunin - 527)).toBeLessThanOrEqual(10);
    expect(Math.abs(jounin - 74)).toBeLessThanOrEqual(2);
    const d = result.defenderLosses!;
    expect([d.min.genin, d.min.chuunin, d.min.jounin].every((v, i) => v <= [383, 268, 62][i])).toBe(true);
    expect([d.max.genin, d.max.chuunin, d.max.jounin].every((v, i) => v >= [383, 268, 62][i])).toBe(true);
  });

  it('plafonne les pertes à 100 %', () => {
    const result = simulateCombat(army([100, 0, 0], {}), army([1000, 0, 0], {}));
    expect(result.attackerLossRate).toBe(1);
    expect(result.defenderLossRate!.max).toBeLessThan(0.1);
  });
});

describe('hôpital', () => {
  it('récupère 10 % au niveau 1, 30 % au niveau 20, +20 % avec le ticket', () => {
    expect(recoveryRate(army([0, 0, 0], { hospital: 0 }))).toBe(0);
    expect(recoveryRate(army([0, 0, 0], { hospital: 1 }))).toBe(10);
    expect(recoveryRate(army([0, 0, 0], { hospital: 20 }))).toBe(30);
    expect(recoveryRate(army([0, 0, 0], { hospital: 5 }, true))).toBe(34);
  });

  it('soigne une part des pertes de chaque camp', () => {
    const guerre = army([1108, 703, 114], { training: 5, academy: 8, chunnin: 8, jounin: 5, hospital: 10 });
    const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 }, true);
    const result = simulateCombat(guerre, matrice);
    // Pertes 132 / 84 / 14, hôpital 10 → 19 % : 25,08 / 15,96 / 2,66, arrondis à l'inférieur.
    expect(result.attackerRecovered).toEqual({ genin: 25, chuunin: 15, jounin: 2 });
    // Ticket seul : 20 % des pertes du défenseur.
    expect(result.defenderRecoveryRate).toBe(20);
    expect(result.defenderRecovered!.max.genin).toBe(Math.floor(result.defenderLosses!.max.genin * 0.2));
  });
});

describe('optimalAttack', () => {
  const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 });
  const levels = army([0, 0, 0], { training: 5, academy: 8, chunnin: 8, jounin: 5 });
  const plenty = { genin: 10_000, chuunin: 10_000, jounin: 10_000 };

  it('envoie 15 Genin pour 10 Chuunin pour 6 Jounin, juste assez pour gagner', () => {
    const plan = optimalAttack(levels, matrice, plenty, 0);
    const { genin, chuunin, jounin } = plan.troops;
    expect(genin / chuunin).toBeCloseTo(1.5, 1);
    expect(chuunin / jounin).toBeCloseTo(10 / 6, 1);
    expect(plan.enough).toBe(true);
    expect(plan.result.attackerWins).toBe(true);
  });

  it('reconstitue plus vite qu’une armée d’un seul type', () => {
    const plan = optimalAttack(levels, matrice, plenty, 10);
    for (const only of ['genin', 'chuunin', 'jounin'] as const) {
      const single = optimalAttack(levels, matrice, { genin: 0, chuunin: 0, jounin: 0, [only]: 10_000 }, 10);
      expect(rebuildMinutes(plan.result.attackerLosses)).toBeLessThan(rebuildMinutes(single.result.attackerLosses));
    }
  });

  it('envoie tout un type limité et complète avec les autres', () => {
    const plan = optimalAttack(levels, matrice, { genin: 10_000, chuunin: 50, jounin: 10_000 }, 10);
    expect(plan.troops.chuunin).toBe(50);
    expect(plan.troops.genin / plan.troops.jounin).toBeCloseTo(50 / 20, 1);
    expect(plan.enough).toBe(true);
  });

  it('signale une armée insuffisante', () => {
    const plan = optimalAttack(levels, matrice, { genin: 100, chuunin: 10, jounin: 1 }, 10);
    expect(plan.enough).toBe(false);
    expect(plan.troops).toEqual({ genin: 100, chuunin: 10, jounin: 1 });
  });

  it('ignore l’hôpital', () => {
    const withHospital = { ...levels, levels: { ...levels.levels, hospital: 20 }, hospitalTicket: true };
    expect(optimalAttack(withHospital, matrice, plenty, 10).result.attackerRecoveryRate).toBe(0);
  });
});
