import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CombatData } from '../combat/combat.js';
import { emptySide, SideForm } from '../combat/combat-form.js';
import { attackerLine, passDetail, reportText, runRaz, RazState } from './raz-format.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8'));
const data: CombatData = { rules: json.combat, buildings: json.buildings };
const side = (player: string, genin: number): SideForm => ({ ...emptySide(), player, troops: { genin, chuunin: 0, jounin: 0 } });

describe('rapport de raz', () => {
  const state: RazState = { defender: side('Konan', 1000), attackers: [side('Tard', 900), side('Abimaru', 800), side('', 300)], healedReturn: false };

  it('décrit chaque attaquant dans la fiche', () => {
    assert.match(attackerLine(data, state.attackers[0], 0), /\*\*1\. Tard\*\* · 👥 900 \/ 0 \/ 0 · 💪 9 000/);
    assert.match(attackerLine(data, emptySide(), 3), /\*\*4\. Attaquant 4\*\* · 👥 armée à saisir/);
  });

  it('donne l’ordre de passage avec crashs et passages', () => {
    const plan = runRaz(data, state);
    const text = reportText(plan, state);
    // Défense 1000 : Tard crashe (meilleur ratio), Abimaru passe, l'attaquant 3 crashe.
    assert.match(text, /✅ \*\*1\*\* passent · 💥 \*\*2\*\* crashs/);
    assert.match(text, /\*\*1\. Tard\*\* — 💥 Crash/);
    assert.match(text, /\*\*2\. Abimaru\*\* — ✅ Passe/);
    assert.ok(text.length < 4000);
  });

  it('détaille un passage', () => {
    const plan = runRaz(data, state);
    const detail = passDetail(plan.passes[1], 2, state);
    assert.match(detail, /Abimaru\*\* — ✅ Passe/);
    assert.match(detail, /🛡️ \*\*Défenseur · Konan\*\*/);
    assert.match(detail, /après le passage/);
  });
});
