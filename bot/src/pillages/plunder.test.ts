import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Buildings } from '../build-guide/buildings.js';
import { planFullTeams, planPlunder, plunderCapacities, plunderOf, storageCapacity, TroopsData } from './plunder.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')) as { buildings: Buildings; troops: TroopsData };
const caps = plunderCapacities(json.troops);
const sum = (plan: ReturnType<typeof planPlunder>, k: 'genin' | 'chuunin' | 'jounin') => plan.groups.reduce((n, g) => n + g.team[k] * g.count, 0);

describe('pillages', () => {
  it('lit les capacités des troupes et des dépôts', () => {
    assert.deepEqual(caps, { genin: 13, chuunin: 26, jounin: 53 });
    // Dépôt de ressources 8 : 6 283 ; Dépôt de nourriture 4 : 2 400.
    assert.deepEqual(storageCapacity(json.buildings, 8, 4), { resources: 6283, food: 2400, target: 2400 });
  });

  it('remplit exactement quand c’est possible', () => {
    const plan = planPlunder({ genin: 1000, chuunin: 0, jounin: 0 }, 1300, caps);
    assert.deepEqual(plan.groups, [{ team: { genin: 100, chuunin: 0, jounin: 0 }, capacity: 1300, count: 10 }]);
  });

  it('utilise toute l’armée, sans dépasser la cible, avec le moins d’équipes possible', () => {
    const army = { genin: 693, chuunin: 414, jounin: 53 };
    for (const target of [999, 4098, 6283]) {
      const plan = planPlunder(army, target, caps);
      assert.deepEqual([sum(plan, 'genin'), sum(plan, 'chuunin'), sum(plan, 'jounin')], [693, 414, 53]);
      assert.ok(plan.groups.every((g) => g.capacity <= target && plunderOf(g.team, caps) === g.capacity));
      assert.ok(plan.teams <= Math.ceil(plan.total / target) + 1);
    }
  });

  it('répartit en équipes équilibrées qui ne remplissent pas forcément les dépôts', () => {
    const plan = planPlunder({ genin: 1050, chuunin: 0, jounin: 0 }, 6283, caps);
    assert.deepEqual(plan.groups, [{ team: { genin: 350, chuunin: 0, jounin: 0 }, capacity: 4550, count: 3 }]);
  });

  it('ne forme aucune équipe sans troupes', () => {
    assert.equal(planPlunder({ genin: 0, chuunin: 0, jounin: 0 }, 5000, caps).teams, 0);
  });
});

describe('pillage max (équipes qui remplissent les dépôts)', () => {
  it('remplit exactement quand c’est possible, sans reste', () => {
    const plan = planFullTeams({ genin: 1000, chuunin: 0, jounin: 0 }, 1300, caps);
    assert.deepEqual(plan, { team: { genin: 100, chuunin: 0, jounin: 0 }, capacity: 1300, teams: 10, leftover: { genin: 0, chuunin: 0, jounin: 0 } });
  });

  it('ne dépasse jamais la cible, et le reste complète l’armée', () => {
    const army = { genin: 693, chuunin: 414, jounin: 53 };
    for (const target of [100, 999, 4098, 6283]) {
      const plan = planFullTeams(army, target, caps);
      assert.ok(plan.capacity <= target);
      assert.equal(plunderOf(plan.team, caps), plan.capacity);
      for (const k of ['genin', 'chuunin', 'jounin'] as const) assert.equal(plan.team[k] * plan.teams + plan.leftover[k], army[k]);
    }
  });

  it('prend toute l’armée quand elle ne suffit pas à remplir les dépôts', () => {
    const plan = planFullTeams({ genin: 10, chuunin: 5, jounin: 1 }, 100_000, caps);
    assert.deepEqual([plan.team, plan.teams], [{ genin: 10, chuunin: 5, jounin: 1 }, 1]);
  });

  it('à pillage égal, privilégie la composition qui forme le plus d’équipes', () => {
    // 26 de pillage : 2 Genin (5 équipes) ou 1 Chuunin (1 équipe).
    const plan = planFullTeams({ genin: 10, chuunin: 1, jounin: 0 }, 26, caps);
    assert.deepEqual([plan.team, plan.teams], [{ genin: 2, chuunin: 0, jounin: 0 }, 5]);
  });
});
