import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { CombatData } from './combat.js';
import { applySubmit, emptySide, formValues, optimalText, optimize, parseNumbers, prefillNote, resultText, sideText, simulate, SideForm } from './combat-form.js';

const json = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8'));
const data: CombatData = { rules: json.combat, buildings: json.buildings };

const tard: SideForm = {
  ...emptySide(),
  player: 'Tard',
  troops: { genin: 500, chuunin: 300, jounin: null },
  levels: { training: 11, academy: 8, chunnin: 8, jounin: null, hospital: 3, wall: 1 },
};

describe('formulaire de combat', () => {
  it('lit les listes de nombres, « ? » pour inconnu', () => {
    assert.deepEqual(parseNumbers('500 300 100', 3), [500, 300, 100]);
    assert.deepEqual(parseNumbers('500/300/100', 3), [500, 300, 100]);
    assert.deepEqual(parseNumbers('11 ? 8 5', 4, 20), [11, null, 8, 5]);
    assert.deepEqual(parseNumbers('', 3), [null, null, null]);
    assert.equal(parseNumbers('1 500 300 100', 3), null);
    assert.equal(parseNumbers('25 8 8 5', 4, 20), null);
  });

  it('affiche les valeurs connues dans le formulaire', () => {
    assert.deepEqual(formValues(tard), { player: 'Tard', troops: '500 300 0', levels: '11 8 8 ?', hospital: '3', wall: '1' });
    assert.deepEqual(formValues(emptySide()), { player: '', troops: '', levels: '', hospital: '', wall: '' });
  });

  it('ne change que ce qui a été modifié', () => {
    const shown = formValues(tard);
    const r = applySubmit(tard, { ...shown, troops: '600 300 0' }, null);
    assert.ok('side' in r);
    assert.deepEqual(r.side.troops, { genin: 600, chuunin: 300, jounin: 0 });
    assert.equal(r.side.levels.jounin, null);
  });

  it('préremplit depuis un joueur connu, en gardant les tickets', () => {
    const konan: SideForm = { ...emptySide(), player: 'Konan', troops: { genin: 10, chuunin: 20, jounin: 30 } };
    const r = applySubmit({ ...tard, combatTicket: true }, { ...formValues(tard), player: 'konan' }, (n) => (n === 'konan' ? konan : null));
    assert.ok('side' in r);
    assert.equal(r.side.player, 'Konan');
    assert.deepEqual(r.side.troops, { genin: 10, chuunin: 20, jounin: 30 });
    assert.equal(r.side.combatTicket, true);
  });

  it('signale une saisie illisible', () => {
    const r = applySubmit(tard, { ...formValues(tard), levels: '11 8' }, null);
    assert.ok('error' in r && /Niveaux/.test(r.error));
  });

  it('met en forme un camp et le résultat', () => {
    assert.match(sideText(data, tard, true), /🧱 Mur 1/);
    assert.match(sideText(data, tard, false), /^👥 500 \/ 300 \/ \?/);
    assert.match(resultText(simulate(data, { attacker: emptySide(), defender: tard })), /Renseigne/);
    const text = resultText(simulate(data, { attacker: { ...tard, troops: { genin: 5000, chuunin: 3000, jounin: 1000 } }, defender: tard }));
    assert.match(text, /Avantage assaillant/);
    assert.match(text, /Points : assaillant \+/);
  });
});

describe('optimisation dans la fiche', () => {
  const matrice: SideForm = {
    ...emptySide(),
    troops: { genin: 693, chuunin: 414, jounin: 53 },
    levels: { training: 2, academy: 8, chunnin: 8, jounin: 5, wall: 1, hospital: null },
  };
  const me: SideForm = { ...emptySide(), levels: { training: 5, academy: 8, chunnin: 8, jounin: 5, wall: null, hospital: null } };

  it('propose l’armée à envoyer avec les niveaux de l’assaillant', () => {
    const state = { attacker: me, defender: matrice, optimize: { available: { genin: 10_000, chuunin: 10_000, jounin: 10_000 }, marginPct: 10 } };
    const plan = optimize(data, state);
    assert.ok(plan?.enough);
    assert.match(optimalText(plan, state), /➡️ Envoyer \*\*/);
    assert.match(optimalText(plan, state), /reconstruction ⏱️/);
  });

  it('prévient quand l’armée ne suffit pas, ou sans défense', () => {
    const state = { attacker: me, defender: matrice, optimize: { available: { genin: 10, chuunin: 0, jounin: 0 }, marginPct: 10 } };
    assert.match(optimalText(optimize(data, state), state), /ne suffit pas/);
    const empty = { attacker: me, defender: emptySide(), optimize: state.optimize };
    assert.match(optimalText(optimize(data, empty), empty), /Renseigne la défense/);
    assert.equal(optimalText(null, { attacker: me, defender: matrice }), '');
  });

  it('sans armée disponible connue, calcule sans limite', () => {
    const state = { attacker: me, defender: matrice, optimize: { available: null, marginPct: 10 } };
    const plan = optimize(data, state);
    assert.ok(plan?.enough);
    assert.match(optimalText(plan, state), /Sans limite/);
  });
});

describe('message après le choix d’un joueur', () => {
  it('dit ce qui a été prérempli, ou pourquoi rien', () => {
    assert.match(prefillNote({ ...tard }, 'found', 'tard')!, /Tard\*\* prérempli : dernière armée connue et 5 niveaux/);
    assert.match(prefillNote({ ...emptySide(), player: 'Konan' }, 'found', 'konan')!, /ni son armée ni ses niveaux/);
    assert.match(prefillNote(emptySide(), 'missing', 'xyz')!, /introuvable/);
    assert.equal(prefillNote(tard, null, ''), null);
  });
});
