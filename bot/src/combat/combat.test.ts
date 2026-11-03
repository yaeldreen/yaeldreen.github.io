import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { Army, CombatData, optimalAttack, rebuildMinutes, recoveryRate, sideStats, simulateCombat } from './combat.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8'));
const data: CombatData = { rules: json.combat, buildings: json.buildings };

const army = (troops: [number, number, number], levels: Partial<Army['levels']>, hospitalTicket = false, combatTicket = false): Army => ({
  troops: { genin: troops[0], chuunin: troops[1], jounin: troops[2] },
  levels: { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0, hospital: 0, ...levels },
  hospitalTicket,
  combatTicket,
});
const rounded = (p: { genin: number; chuunin: number; jounin: number }) => [p.genin, p.chuunin, p.jounin].map(Math.round);

describe('sideStats (puissances affichées en jeu)', () => {
  // CE 11, Académie 8, Centre Chuunin 8, Centre Jounin 1, Mur 1.
  const mine = army([0, 0, 0], { training: 11, academy: 8, chunnin: 8, jounin: 1, wall: 1 });

  it('attaque 14 / 56 / 73', () => assert.deepEqual(rounded(sideStats(data, mine, false).unitPower), [14, 56, 73]));
  it('défense 14 / 57 / 75 (mur compris)', () => assert.deepEqual(rounded(sideStats(data, mine, true).unitPower), [14, 57, 75]));
  it('ticket défense ×1,2 après les bonus : 19 / 77 / 106', () => {
    const levels = { training: 12, academy: 8, chunnin: 8, jounin: 6, wall: 7 };
    assert.deepEqual(rounded(sideStats(data, army([0, 0, 0], levels, false, true), true).unitPower), [19, 77, 106]);
  });
});

describe('simulateCombat', () => {
  // Rapport du 19/10 : Guerre (CE 5) attaque Matrice (CE 2, Mur 1), Académie / Chuunin 8 et Jounin 5 des deux côtés.
  const guerre = army([1108, 703, 114], { training: 5, academy: 8, chunnin: 8, jounin: 5 });
  const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 });

  it('retrouve les pertes et les points de l’assaillant du rapport', () => {
    const result = simulateCombat(data, guerre, matrice);
    assert.equal(result.attackerWins, true);
    assert.deepEqual(result.attackerLosses, { genin: 132, chuunin: 84, jounin: 14 });
    assert.equal(result.defenderPoints, 692);
  });

  it('encadre les pertes réelles du défenseur (381 Genin)', () => {
    const { defenderLosses } = simulateCombat(data, guerre, matrice);
    assert.ok(defenderLosses!.min.genin <= 381 && defenderLosses!.max.genin >= 381);
  });

  it('plafonne les pertes à 100 %', () => {
    const result = simulateCombat(data, army([100, 0, 0], {}), army([1000, 0, 0], {}));
    assert.equal(result.attackerLossRate, 1);
  });
});

describe('hôpital', () => {
  it('récupère 10 % au niveau 1, 30 % au niveau 20, +20 % avec le ticket', () => {
    assert.equal(recoveryRate(data, army([0, 0, 0], { hospital: 0 })), 0);
    assert.equal(recoveryRate(data, army([0, 0, 0], { hospital: 1 })), 10);
    assert.equal(recoveryRate(data, army([0, 0, 0], { hospital: 20 })), 30);
    assert.equal(recoveryRate(data, army([0, 0, 0], { hospital: 5 }, true)), 34);
  });

  it('soigne en arrondissant à l’inférieur', () => {
    const guerre = army([1108, 703, 114], { training: 5, academy: 8, chunnin: 8, jounin: 5, hospital: 10 });
    const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 }, true);
    assert.deepEqual(simulateCombat(data, guerre, matrice).attackerRecovered, { genin: 25, chuunin: 15, jounin: 2 });
  });
});

describe('optimalAttack', () => {
  const matrice = army([693, 414, 53], { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1 });
  const levels = army([0, 0, 0], { training: 5, academy: 8, chunnin: 8, jounin: 5 });
  const plenty = { genin: 10_000, chuunin: 10_000, jounin: 10_000 };
  const close = (a: number, b: number, digits = 1) => Math.abs(a - b) < 10 ** -digits / 2;

  it('envoie 15 Genin pour 10 Chuunin pour 6 Jounin, juste assez pour gagner', () => {
    const plan = optimalAttack(data, levels, matrice, plenty, 0);
    const { genin, chuunin, jounin } = plan.troops;
    assert.ok(close(genin / chuunin, 1.5));
    assert.ok(close(chuunin / jounin, 10 / 6));
    assert.equal(plan.enough, true);
    assert.equal(plan.result.attackerWins, true);
  });

  it('reconstitue plus vite qu’une armée d’un seul type', () => {
    const plan = optimalAttack(data, levels, matrice, plenty, 10);
    for (const only of ['genin', 'chuunin', 'jounin'] as const) {
      const single = optimalAttack(data, levels, matrice, { genin: 0, chuunin: 0, jounin: 0, [only]: 10_000 }, 10);
      assert.ok(rebuildMinutes(data, plan.result.attackerLosses) < rebuildMinutes(data, single.result.attackerLosses));
    }
  });

  it('envoie tout un type limité et complète avec les autres', () => {
    const plan = optimalAttack(data, levels, matrice, { genin: 10_000, chuunin: 50, jounin: 10_000 }, 10);
    assert.equal(plan.troops.chuunin, 50);
    assert.ok(close(plan.troops.genin / plan.troops.jounin, 50 / 20));
    assert.equal(plan.enough, true);
  });

  it('signale une armée insuffisante', () => {
    const plan = optimalAttack(data, levels, matrice, { genin: 100, chuunin: 10, jounin: 1 }, 10);
    assert.equal(plan.enough, false);
    assert.deepEqual(plan.troops, { genin: 100, chuunin: 10, jounin: 1 });
  });

  it('ignore l’hôpital', () => {
    const withHospital = { ...levels, levels: { ...levels.levels, hospital: 20 }, hospitalTicket: true };
    assert.equal(optimalAttack(data, withHospital, matrice, plenty, 10).result.attackerRecoveryRate, 0);
  });
});
