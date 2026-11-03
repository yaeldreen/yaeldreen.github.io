/** Mise en forme de #simu-raz (fiche et rapport, lignes courtes pour le téléphone). Partie sans Discord, testable. */
import { CombatData, sideStats, TROOP_KEYS, TroopCounts } from '../combat/combat.js';
import { SideForm, toArmy } from '../combat/combat-form.js';
import { num } from '../shared/format.js';
import { planRaz, RazPass, RazPlan } from './raz.js';

export interface RazState {
  defender: SideForm;
  attackers: SideForm[];
  /** Les soignés de l'hôpital du défenseur reviennent avant le passage suivant (hypothèse prudente). */
  healedReturn: boolean;
}

export const MAX_ATTACKERS = 15;

const troops = (t: TroopCounts): string => TROOP_KEYS.map((k) => num(t[k])).join(' / ');
const pct = (rate: number): string => `${(rate * 100).toFixed(1).replace('.', ',')} %`;
const ratio = (r: number | null): string => (r === null ? '?' : r.toFixed(2).replace('.', ','));

export const attackerName = (side: SideForm, index: number): string => side.player || `Attaquant ${index + 1}`;

/** Une ligne par attaquant dans la fiche : troupes et force. */
export function attackerLine(data: CombatData, side: SideForm, index: number): string {
  const army = toArmy(side);
  const known = TROOP_KEYS.some((k) => side.troops[k] !== null);
  const strength = Math.round(sideStats(data, army, false).strength);
  return `**${index + 1}. ${attackerName(side, index)}** · ${known ? `👥 ${troops(army.troops)} · 💪 ${num(strength)}` : '👥 armée à saisir'}${side.combatTicket ? ' · 🎟️' : ''}`;
}

export const runRaz = (data: CombatData, state: RazState): RazPlan =>
  planRaz(data, state.attackers.map(toArmy), toArmy(state.defender), state.healedReturn);

/** Une ligne par passage dans le rapport. */
export function passLine(pass: RazPass, order: number, name: string): string {
  return [
    `**${order}. ${name}** — ${pass.crash ? '💥 Crash' : '✅ Passe'} · D/A ${ratio(pass.result.ratio)} · perd ${pct(pass.result.attackerLossRate)}`,
    `   ☠️ tue ${troops(pass.defenderKilled)} → défense ${troops(pass.defenderAfter)}`,
  ].join('\n');
}

/** Rapport complet : résumé, ordre de passage, attaquants inutiles ou vides. */
export function reportText(plan: RazPlan, state: RazState): string {
  const names = state.attackers.map(attackerName);
  const list = (indexes: number[]) => indexes.map((i) => names[i]).join(', ');
  return [
    `✅ **${plan.wins}** passent · 💥 **${plan.crashes}** crash${plan.crashes > 1 ? 's' : ''} · 🛡️ défense restante **${troops(plan.defenderRemaining)}**`,
    '',
    ...plan.passes.map((p, i) => passLine(p, i + 1, names[p.attacker])),
    ...(plan.unused.length ? ['', `😴 Inutiles, la défense est déjà vide : ${list(plan.unused)}`] : []),
    ...(plan.empty.length ? ['', `⚪ Sans troupes, ignorés : ${list(plan.empty)}`] : []),
    '',
    `_Le plus fort qui peut gagner passe d’abord ; sinon crash de celui qui permet le plus de passages, puis le meilleur ratio pertes / tués. ` +
      `Pertes du défenseur au bas de la fourchette${state.healedReturn ? ', ses soignés reviennent avant chaque passage' : ''}._`,
  ].join('\n');
}

/** Détail d'un passage : forces, troupes de chaque camp, soins, points. */
export function passDetail(pass: RazPass, order: number, state: RazState): string {
  const r = pass.result;
  const sent = toArmy(state.attackers[pass.attacker]).troops;
  const dl = r.defenderLossRate;
  return [
    `**${order}. ${attackerName(state.attackers[pass.attacker], pass.attacker)}** — ${pass.crash ? '💥 Crash' : '✅ Passe'}`,
    `💪 Force assaillant ${num(Math.round(r.attack.strength))} · défense ${num(Math.round(r.defense.strength))} · D/A ${ratio(r.ratio)}`,
    '',
    '🗡️ **Assaillant**',
    `👥 ${troops(sent)}`,
    `☠️ ${troops(r.attackerLosses)} (${pct(r.attackerLossRate)})`,
    `🏥 +${troops(r.attackerRecovered)} soignés (${r.attackerRecoveryRate} %)`,
    '',
    `🛡️ **Défenseur${state.defender.player ? ` · ${state.defender.player}` : ''}**`,
    `👥 ${troops(pass.defenderBefore)}`,
    `☠️ ${troops(pass.defenderKilled)}${dl ? ` (${pct(dl.min)})` : ''}`,
    `➡️ après le passage : **${troops(pass.defenderAfter)}**`,
    '',
    `⭐ Points : assaillant +${r.attackerPoints ? num(r.attackerPoints.min) : '?'}, défenseur +${num(r.defenderPoints)} · ratio pertes / tués ${pass.lossRatio === Infinity ? '∞' : pass.lossRatio.toFixed(2).replace('.', ',')}`,
  ].join('\n');
}
