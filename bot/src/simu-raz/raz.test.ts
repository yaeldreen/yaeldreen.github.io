import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Army, CombatData } from '../combat/combat.js';
import { planRaz as plan } from './raz.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8'));
const data: CombatData = { rules: json.combat, buildings: json.buildings };
const planRaz = (attackers: Army[], defender: Army, healed: boolean) => plan(data, attackers, defender, healed);

const levels = { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0, hospital: 0 };
const army = (genin: number, chuunin = 0, jounin = 0): Army => ({
  troops: { genin, chuunin, jounin },
  levels,
  hospitalTicket: false,
  combatTicket: false,
});

describe('planRaz', () => {
  it('fait passer les plus forts d’abord quand tous peuvent gagner', () => {
    const plan = planRaz([army(150), army(400), army(250)], army(100), false);
    assert.deepEqual(plan.passes.map((p) => p.attacker), [1, 2, 0]);
    assert.equal(plan.crashes, 0);
    assert.equal(plan.passes[1].defenderBefore.genin, 50);
  });

  it('envoie un crash quand personne ne peut gagner, puis fait passer les autres', () => {
    // Défense 1000 : personne ne gagne. Faire crasher 900 (−20,7 %) laisse 793, que 800 bat ; crasher 800 laisse 816,
    // que 900 bat. Une victoire dans les deux cas : 900 crashe car son ratio pertes / tués est meilleur (1,2 contre 1,5).
    const plan = planRaz([army(900), army(800), army(300)], army(1000), false);
    assert.deepEqual([plan.passes[0].attacker, plan.passes[0].crash], [0, true]);
    assert.deepEqual([plan.passes[1].attacker, plan.passes[1].crash], [1, false]);
    assert.equal(plan.wins, 1);
  });

  it('choisit pour le crash le meilleur ratio pertes / tués à nombre de victoires égal', () => {
    // Défense 1000 : 600 perd 61 % pour 138 tués (ratio 2,7), 200 perd tout pour 46 tués (ratio 4,3).
    const plan = planRaz([army(200), army(600)], army(1000), false);
    assert.equal(plan.wins, 0);
    assert.equal(plan.passes[0].attacker, 1);
  });

  it('ignore les attaquants vides et s’arrête quand la défense est vide', () => {
    const plan = planRaz([army(0), army(500), army(500)], army(1), false);
    assert.deepEqual(plan.empty, [0]);
    assert.equal(plan.passes.length, 1);
    assert.deepEqual(plan.unused, [2]);
  });

  it('remet les soignés du défenseur entre deux passages si demandé', () => {
    const defender = { ...army(100), levels: { ...levels, hospital: 20 } };
    const plan = planRaz([army(500)], defender, true);
    assert.equal(plan.passes[0].defenderAfter.genin, 50 + 15);
  });
});
