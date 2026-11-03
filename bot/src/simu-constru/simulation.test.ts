import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Buildings } from '../build-guide/buildings.js';
import { parseDuration, simulateUpgrades, SimulationInput } from './simulation.js';

const { buildings } = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')) as { buildings: Buildings };
const capacity = (id: string, level: number) => Number(buildings[id].levels.find((l) => l.level === level)!['capacity']);

describe('parseDuration', () => {
  it('lit tous les formats des tableaux', () => {
    assert.equal(parseDuration('0:00:03:20'), 200);
    assert.equal(parseDuration('1min 47s'), 107);
    assert.equal(parseDuration('1 j 4 h 50 min'), 86400 + 4 * 3600 + 50 * 60);
    assert.equal(parseDuration('55 sec'), 55);
    assert.equal(parseDuration('18 secondes'), 18);
    assert.equal(parseDuration('0'), 0);
  });

  it('accepte chaque temps de construction de chaque bâtiment', () => {
    for (const b of Object.values(buildings)) {
      for (const row of b.levels) assert.doesNotThrow(() => parseDuration(String(row['buildTime'])), `${b.name} niv. ${row.level}`);
    }
  });

  it('refuse un texte inconnu', () => {
    assert.throws(() => parseDuration('2 semaines'));
  });
});

describe('simulateUpgrades', () => {
  const base: SimulationInput = { buildingId: 'hq', currentLevel: 1, targetLevel: 2, resourceDepotLevel: 20, foodDepotLevel: 20 };

  it('n’ajoute aucun dépôt quand la capacité suffit', () => {
    const plan = simulateUpgrades(buildings, base);
    assert.deepEqual(plan.steps.map((s) => [s.buildingId, s.level]), [['hq', 2]]);
    assert.equal(plan.totalSeconds, 200);
    assert.equal(plan.storageSeconds, 0);
  });

  it('monte les dépôts au niveau juste suffisant, puis construit', () => {
    // Jounin niv. 1 : pierre 7 000 → Dépôt de ressources niv. 9 ; nourriture 5 200 → Dépôt de nourriture niv. 8.
    const plan = simulateUpgrades(buildings, { ...base, buildingId: 'jounin', currentLevel: 0, targetLevel: 1, resourceDepotLevel: 1, foodDepotLevel: 1 });
    const last = (id: string) => Math.max(...plan.steps.filter((s) => s.buildingId === id).map((s) => s.level));
    assert.equal(last('resourceDepot'), 9);
    assert.equal(last('foodDepot'), 8);
    assert.deepEqual([plan.steps.at(-1)?.buildingId, plan.steps.at(-1)?.level, plan.steps.at(-1)?.isStorage], ['jounin', 1, false]);
    assert.equal(plan.blocker, undefined);
  });

  it('respecte la capacité des dépôts à chaque étape', () => {
    const input: SimulationInput = { ...base, buildingId: 'jounin', currentLevel: 0, targetLevel: 20, resourceDepotLevel: 1, foodDepotLevel: 1 };
    const plan = simulateUpgrades(buildings, input);
    let res = input.resourceDepotLevel;
    let food = input.foodDepotLevel;
    for (const step of plan.steps) {
      assert.ok(Math.max(Number(step.row['stone']), Number(step.row['wood']), Number(step.row['iron'])) <= capacity('resourceDepot', res));
      assert.ok(Number(step.row['food']) <= capacity('foodDepot', food));
      if (step.buildingId === 'resourceDepot') res = step.level;
      if (step.buildingId === 'foodDepot') food = step.level;
    }
    assert.equal(plan.steps.at(-1)?.level, 20);
  });

  it('fait évoluer le dépôt choisi comme bâtiment cible avec ses propres améliorations', () => {
    const plan = simulateUpgrades(buildings, { ...base, buildingId: 'resourceDepot', currentLevel: 3, targetLevel: 5, resourceDepotLevel: 1 });
    assert.deepEqual(plan.steps.map((s) => s.level), [4, 5]);
  });

  it('signale un niveau sans données (Commerces niv. 5)', () => {
    const plan = simulateUpgrades(buildings, { ...base, buildingId: 'commerce', currentLevel: 3, targetLevel: 7 });
    assert.deepEqual(plan.steps.map((s) => s.level), [4]);
    assert.match(plan.blocker ?? '', /niv\. 5 non renseignés/);
  });

  it('signale un niveau visé au-delà du maximum', () => {
    const plan = simulateUpgrades(buildings, { ...base, currentLevel: 19, targetLevel: 21 });
    assert.equal(plan.steps.length, 1);
    assert.match(plan.blocker ?? '', /niveau maximum/);
  });
});
