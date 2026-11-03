/** Mise en forme du tableau des retours pour Discord (lignes courtes, lisibles sur téléphone). */
import { formatDuration, num } from '../shared/format.js';
import { parisClock, parisDay } from '../shared/paris-time.js';
import { ReturnRow } from './travel.js';

export interface ReturnsView {
  distanceKm: number;
  attackedAtMs: number;
  rows: ReturnRow[];
  /** « Leaf village → Malice at the pa », si les villages sont connus. */ route?: string;
  /** Contre-attaque du membre : CE, distance, d'où elle part, heure d'arrivée. */
  counter?: { level: number; distanceKm: number; from: string; arrivalMs: number };
  /** CE de l'assaillant s'il est connu (sa ligne est mise en avant). */ attackerCe?: number | null;
  /** L'heure d'attaque n'est connue qu'à la minute près (journal du clan). */ minutePrecision?: boolean;
}

const km = (d: number): string => num(d).replace('.', ',');
const margin = (ms: number): string => `${ms >= 0 ? '+' : '−'}${formatDuration(Math.abs(ms) / 1000)}`;
const verdict = (ms: number | null): string => (ms === null ? '' : ` ${ms > 0 ? '✅' : '❌'} ${margin(ms)}`);

export function returnsDescription(view: ReturnsView): string {
  const head = [
    `⚔️ Attaque à **${parisClock(view.attackedAtMs)}** (${parisDay(view.attackedAtMs)})`,
    ...(view.route ? [`🗺️ ${view.route}`] : []),
    view.counter
      ? `🏃 Ta contre-attaque (CE ${view.counter.level}, ${km(view.counter.distanceKm)} km depuis ${view.counter.from}) arrive à **${parisClock(view.counter.arrivalMs)}** si tu pars maintenant`
      : '_Pour savoir si un retour est faisable : `!monCE 11` dans #gestion-joueurs._',
    ...(view.attackerCe ? [`⭐ CE connu de l'assaillant : ${view.attackerCe}`] : []),
    ...(view.minutePrecision ? ["⏳ Heure du journal à la minute près : chaque retour peut arriver jusqu'à 59 s plus tard."] : []),
    '',
  ];
  const lines = view.rows.map((r) => {
    const star = r.level === view.attackerCe ? '⭐ ' : '';
    return `${star}**CE ${r.level}** · 🕐 ${parisClock(r.returnAt)}${verdict(r.marginMs)} · 🎟️ ${parisClock(r.ticketReturnAt)}${verdict(r.ticketMarginMs)}`;
  });
  return [...head, ...lines].join('\n');
}

export const returnsTitle = (view: ReturnsView): string => `↩️ Retours · ${km(view.distanceKm)} km`;
