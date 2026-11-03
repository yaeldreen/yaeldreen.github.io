/** Saisie et affichage d'une simulation de combat dans Discord (partie sans Discord, testable). */
import { formatDuration, num } from '../shared/format.js';
import { Army, ArmyLevels, CombatData, CombatResult, OptimalAttack, optimalAttack, sideStats, simulateCombat, TROOP_KEYS, TroopCounts } from './combat.js';

type LevelKey = keyof ArmyLevels;

/** Un camp tel que saisi : null = inconnu (compté comme 0). */
export interface SideForm {
  player: string;
  troops: Record<keyof TroopCounts, number | null>;
  levels: Record<LevelKey, number | null>;
  hospitalTicket: boolean;
  combatTicket: boolean;
}

export interface CombatState {
  attacker: SideForm;
  defender: SideForm;
  /**
   * Optimisation demandée : armée disponible de l'assaillant (null = sans limite) et marge de sécurité.
   * Recalculée à chaque changement de la fiche.
   */
  optimize?: { available: TroopCounts | null; marginPct: number };
}

export const emptySide = (): SideForm => ({
  player: '',
  troops: { genin: null, chuunin: null, jounin: null },
  levels: { training: null, academy: null, chunnin: null, jounin: null, wall: null, hospital: null },
  hospitalTicket: false,
  combatTicket: false,
});

const LEVEL_MAX = 20;

export function toArmy(side: SideForm): Army {
  const count = (v: number | null) => Math.max(0, Math.floor(v ?? 0));
  const level = (v: number | null) => Math.min(LEVEL_MAX, Math.max(0, Math.floor(v ?? 0)));
  return {
    troops: { genin: count(side.troops.genin), chuunin: count(side.troops.chuunin), jounin: count(side.troops.jounin) },
    levels: {
      training: level(side.levels.training),
      academy: level(side.levels.academy),
      chunnin: level(side.levels.chunnin),
      jounin: level(side.levels.jounin),
      wall: level(side.levels.wall),
      hospital: level(side.levels.hospital),
    },
    hospitalTicket: side.hospitalTicket,
    combatTicket: side.combatTicket,
  };
}

// --- Champs du formulaire Discord (texte libre) ---

const show = (v: number | null): string => (v === null ? '' : String(v));

/** Texte des champs du formulaire pour un camp (vide = inconnu). */
export const formValues = (side: SideForm) => ({
  player: side.player,
  troops: TROOP_KEYS.every((k) => side.troops[k] === null) ? '' : TROOP_KEYS.map((k) => show(side.troops[k]) || '0').join(' '),
  levels: (['training', 'academy', 'chunnin', 'jounin'] as const).map((k) => show(side.levels[k]) || '?').join(' ').replace(/^(\? ?)+$/, ''),
  hospital: show(side.levels.hospital),
  wall: show(side.levels.wall),
});

/**
 * Liste de nombres « 500 300 100 », « 500/300/100 », « 11 8 8 5 » ; « ? » = inconnu.
 * Retourne null si la saisie ne contient pas exactement `count` éléments.
 */
export function parseNumbers(text: string, count: number, max = Infinity): (number | null)[] | null {
  const parts = text.trim().split(/[\s/;,|]+/).filter(Boolean);
  if (!parts.length) return Array(count).fill(null);
  if (parts.length !== count) return null;
  const values = parts.map((p) => (p === '?' ? null : Number(p)));
  return values.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= max)) ? values : null;
}

export interface SideSubmit {
  player: string;
  troops: string;
  levels: string;
  hospital: string;
  wall?: string;
}

/**
 * Applique un formulaire soumis. Un nouveau joueur reconnu préremplit le camp (`prefill`) ; les champs que
 * l'utilisateur a modifiés par rapport à ce qui était affiché passent avant. Retourne le camp ou une erreur.
 */
export function applySubmit(
  side: SideForm,
  submit: SideSubmit,
  prefill: ((name: string) => SideForm | null) | null,
): { side: SideForm; prefilled: 'found' | 'missing' | null } | { error: string } {
  const shown = formValues(side);
  let next: SideForm = { ...side, troops: { ...side.troops }, levels: { ...side.levels } };
  const player = submit.player.trim();
  let prefilled: 'found' | 'missing' | null = null;
  if (player !== shown.player.trim()) {
    const loaded = player && prefill ? prefill(player) : null;
    prefilled = player ? (loaded ? 'found' : 'missing') : null;
    next = loaded ? { ...loaded, hospitalTicket: side.hospitalTicket, combatTicket: side.combatTicket } : { ...next, player };
  }

  if (submit.troops.trim() !== shown.troops) {
    const troops = parseNumbers(submit.troops, 3);
    if (!troops) return { error: 'Troupes : 3 nombres attendus, ex. `500 300 100` (Genin Chuunin Jounin), sans espace dans les nombres.' };
    TROOP_KEYS.forEach((k, i) => (next.troops[k] = troops[i]));
  }
  if (submit.levels.trim() !== shown.levels) {
    const levels = parseNumbers(submit.levels, 4, LEVEL_MAX);
    if (!levels) return { error: 'Niveaux : 4 nombres de 0 à 20, ex. `11 8 8 5` (CE Académie Chuunin Jounin), `?` si inconnu.' };
    (['training', 'academy', 'chunnin', 'jounin'] as const).forEach((k, i) => (next.levels[k] = levels[i]));
  }
  for (const key of ['hospital', 'wall'] as const) {
    const text = submit[key];
    if (text === undefined || text.trim() === shown[key]) continue;
    const [value] = parseNumbers(text, 1, LEVEL_MAX) ?? [undefined];
    if (value === undefined) return { error: `${key === 'wall' ? 'Mur' : 'Hôpital'} : un niveau de 0 à 20.` };
    next.levels[key] = value;
  }
  return { side: next, prefilled };
}

/** Message après un changement de joueur dans le formulaire : ce qui a été prérempli, ou pourquoi rien. */
export function prefillNote(side: SideForm, prefilled: 'found' | 'missing' | null, typed: string): string | null {
  if (prefilled === 'missing') return `« ${typed} » : joueur introuvable (ou plusieurs correspondent). Écris son nom ou son village plus précisément.`;
  if (prefilled !== 'found') return null;
  const troops = TROOP_KEYS.some((k) => side.troops[k] !== null);
  const levels = Object.values(side.levels).filter((v) => v !== null).length;
  if (!troops && !levels) {
    return `**${side.player}** reconnu, mais on ne connaît ni son armée ni ses niveaux : renseigne-les dans le formulaire, ou dans #infos-ennemis (\`!rapport\`, \`!niveaux\`).`;
  }
  return `**${side.player}** prérempli : ${[troops && 'dernière armée connue', levels && `${levels} niveau${levels > 1 ? 'x' : ''}`].filter(Boolean).join(' et ')}.`;
}

// --- Affichage ---

const unknown = (v: number | null): string => (v === null ? '?' : String(v));
const troopsLine = (t: TroopCounts): string => TROOP_KEYS.map((k) => num(t[k])).join(' / ');
const pct = (rate: number): string => `${(rate * 100).toFixed(1).replace('.', ',')} %`;
const range = (a: number, b: number): string => (a === b ? num(a) : `${num(a)}–${num(b)}`);

/** Fiche d'un camp : troupes, niveaux, tickets, force. */
export function sideText(data: CombatData, side: SideForm, defending: boolean): string {
  const army = toArmy(side);
  const stats = sideStats(data, army, defending);
  const t = side.troops;
  const l = side.levels;
  return [
    TROOP_KEYS.every((k) => t[k] === null) ? '👥 Armée inconnue' : `👥 ${TROOP_KEYS.map((k) => (t[k] === null ? '?' : num(t[k]!))).join(' / ')}`,
    `🏋️ CE ${unknown(l.training)} · Acad ${unknown(l.academy)} · Chu ${unknown(l.chunnin)} · Jou ${unknown(l.jounin)}`,
    `🏥 Hôpital ${unknown(l.hospital)}${defending ? ` · 🧱 Mur ${unknown(l.wall)}` : ''}`,
    `🎟️ ${defending ? 'Défense' : 'Attaque'} ${side.combatTicket ? '✅' : '❌'} · Hôpital ${side.hospitalTicket ? '✅' : '❌'}`,
    `💪 Force **${num(Math.round(stats.strength))}** (${TROOP_KEYS.map((k) => Math.round(stats.unitPower[k])).join(' / ')} par unité)`,
  ].join('\n');
}

/** Résultat du combat, en lignes courtes. */
export function resultText(result: CombatResult): string {
  if (result.ratio === null) return 'Renseigne l’armée de l’assaillant avec **✏️ Assaillant**.';
  const dl = result.defenderLosses!;
  const dr = result.defenderRecovered!;
  const dRate = result.defenderLossRate!;
  return [
    result.attackerWins ? '🏆 **Avantage assaillant**' : '🛡️ **Avantage défenseur**',
    `Rapport de force D/A : ${result.ratio.toFixed(2).replace('.', ',')}`,
    '',
    `🗡️ **Assaillant** perd ${pct(result.attackerLossRate)}`,
    `☠️ ${troopsLine(result.attackerLosses)}`,
    `🏥 +${troopsLine(result.attackerRecovered)} soignés (${result.attackerRecoveryRate} %)`,
    '',
    `🛡️ **Défenseur** perd ${dRate.min === dRate.max ? pct(dRate.min) : `${pct(dRate.min)} à ${pct(dRate.max)}`}`,
    `☠️ ${TROOP_KEYS.map((k) => range(dl.min[k], dl.max[k])).join(' / ')}`,
    `🏥 +${TROOP_KEYS.map((k) => range(dr.min[k], dr.max[k])).join(' / ')} soignés (${result.defenderRecoveryRate} %)`,
    '',
    `⭐ Points : assaillant +${range(result.attackerPoints!.min, result.attackerPoints!.max)}, défenseur +${num(result.defenderPoints)}`,
  ].join('\n');
}

export const simulate = (data: CombatData, state: CombatState): CombatResult => simulateCombat(data, toArmy(state.attacker), toArmy(state.defender));

// --- Optimisation de l'attaque ---

/** Armée « sans limite » quand le membre n'a pas donné son armée disponible. */
const UNLIMITED: TroopCounts = { genin: 1_000_000, chuunin: 1_000_000, jounin: 1_000_000 };

/** Armée optimale pour l'assaillant de la fiche (ses niveaux et son ticket attaque), face au défenseur ; null sans défense. */
export function optimize(data: CombatData, state: CombatState): OptimalAttack | null {
  if (!state.optimize) return null;
  const defender = toArmy(state.defender);
  if (sideStats(data, defender, true).strength <= 0) return null;
  const { troops: _ignored, ...attacker } = toArmy(state.attacker);
  return optimalAttack(data, attacker, defender, state.optimize.available ?? UNLIMITED, state.optimize.marginPct);
}

const minutesLine = (m: TroopCounts): string => `⏱️ **${formatDuration(Math.max(...TROOP_KEYS.map((k) => m[k])) * 60)}** (${TROOP_KEYS.map((k) => formatDuration(m[k] * 60)).join(' / ')})`;

/** Texte de l'armée optimale : quoi envoyer, et le temps pour reformer les pertes de chaque camp. */
export function optimalText(plan: OptimalAttack | null, state: CombatState): string {
  if (!state.optimize) return '';
  if (!plan) return 'Renseigne la défense (✏️ Défenseur) pour calculer l’armée optimale.';
  const { available, marginPct } = state.optimize;
  const enemy = plan.result.defenderLosses;
  return [
    `${available ? `Ton armée disponible : ${troopsLine(available)}` : 'Sans limite d’armée (`!dispo` pour donner la tienne)'} · marge ${marginPct} %`,
    plan.enough
      ? `➡️ Envoyer **${troopsLine(plan.troops)}**`
      : `⚠️ Ton armée disponible ne suffit pas à battre la défense (+${marginPct} %) : même en envoyant tout (${troopsLine(plan.troops)}).`,
    `☠️ Tes pertes : ${troopsLine(plan.result.attackerLosses)}`,
    `   reconstruction ${minutesLine(plan.lostMinutes)}`,
    ...(enemy && plan.enemyLostMinutes
      ? [
          `☠️ Pertes ennemies : ${TROOP_KEYS.map((k) => range(enemy.min[k], enemy.max[k])).join(' / ')}`,
          `   reconstruction ⏱️ **${formatDuration(Math.max(...TROOP_KEYS.map((k) => plan.enemyLostMinutes!.min[k])) * 60)}** au moins`,
        ]
      : []),
    '-# Pertes reformées le plus vite possible (15 Genin pour 10 Chuunin pour 6 Jounin), hôpital ignoré.',
  ].join('\n');
}
