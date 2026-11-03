/** Mise en forme de #infos-ennemis (fiches courtes, lisibles sur téléphone). Partie sans Discord, testable. */
import type { TroopCounts } from '../combat/combat.js';
import type { ArmyRecord, KnownPlayer, MapVillage } from '../game-data.js';
import type { EvolutionRow } from '../gestion-joueurs/monthly-snapshot.js';
import { num } from '../shared/format.js';
import type { MemberLevels } from '../shared/member-levels.js';
import type { PartialCounts } from '../retours/report-parser.js';
import type { PlayerLevels } from './store.js';

const KEYS = ['genin', 'chuunin', 'jounin'] as const;

/** Troupes restantes d'après un rapport : ninjas − tués (jamais négatif) ; null si une valeur n'a pas été lue. */
export function survivors(ninjas: PartialCounts, killed: PartialCounts): TroopCounts | null {
  if (KEYS.some((k) => ninjas[k] === null)) return null;
  return Object.fromEntries(KEYS.map((k) => [k, Math.max(0, ninjas[k]! - (killed[k] ?? 0))])) as TroopCounts;
}

export const troopsLine = (t: TroopCounts): string => KEYS.map((k) => num(t[k])).join(' / ');
const partialLine = (t: PartialCounts): string => KEYS.map((k) => (t[k] === null ? '?' : num(t[k]!))).join(' / ');

/** « il y a 3 h », « il y a 2 j ». */
export function age(iso: string, nowMs = Date.now()): string {
  const minutes = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 48 * 60) return `il y a ${Math.round(minutes / 60)} h`;
  return `il y a ${Math.round(minutes / 1440)} j`;
}

const signed = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : ` (${n > 0 ? '+' : n < 0 ? '−' : '±'}${num(Math.abs(n))} sur le mois)`;
const level = (v: number | null | undefined): string => (v === null || v === undefined ? '?' : String(v));

/** Ligne des niveaux connus d'un joueur. */
export const levelsLine = (p: KnownPlayer): string =>
  `🏋️ CE ${level(p.ce)} · Acad ${level(p.academy)} · Chu ${level(p.chunninCenter)} · Jou ${level(p.jouninCenter)} · 🏥 ${level(p.hospital)} · 🧱 ${level(p.wall)}`;

/** Fiche d'un joueur : village, clan, points et habitants (évolution du mois), niveaux, dernière armée. */
export function playerCard(p: KnownPlayer, village: MapVillage | null, army: ArmyRecord | undefined, evolution: EvolutionRow | undefined, nowMs = Date.now()): string {
  return [
    `🏯 ${p.village || '?'} · ${p.clan ?? 'Sans clan'}${village ? ` · 📍 ${village.x} / ${village.y}` : ''}`,
    `⭐ ${p.points != null ? num(p.points) : '?'} pts${signed(evolution?.pointsDelta)} · 👥 ${p.inhabitants != null ? num(p.inhabitants) : '?'} hab.${signed(evolution?.inhabitantsDelta)}`,
    levelsLine(p),
    army ? `⚔️ ${troopsLine(army.troops)} (${age(army.updatedAt, nowMs)}${army.side ? `, ${army.side.toLowerCase()}` : ''})` : '⚔️ Armée inconnue',
    ...(p.comment ? ['', `💬 ${p.comment}`, `_${[p.commentBy, p.commentAt && age(p.commentAt, nowMs)].filter(Boolean).join(', ')}_`] : []),
  ].join('\n');
}

/** Une ligne par joueur d'un clan, les plus gros d'abord. */
export function clanLines(players: readonly KnownPlayer[], armies: ReadonlyMap<string, ArmyRecord>, key: (name: string) => string): string[] {
  return [...players]
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name, 'fr'))
    .map((p) => {
      const army = armies.get(key(p.name));
      return `**${p.name}** · ${p.points != null ? `${num(p.points)} pts` : '? pts'} · CE ${level(p.ce)}${army ? ` · ⚔️ ${troopsLine(army.troops)}` : ''}`;
    });
}

/** Une section de rapport pour le récapitulatif avant enregistrement. */
export function sectionLine(side: string | null, name: string, ninjas: PartialCounts, killed: PartialCounts, remaining: TroopCounts | null): string {
  return [
    `**${side ?? 'Section'} · ${name}**`,
    `👥 ${partialLine(ninjas)} − ☠️ ${partialLine(killed)}`,
    remaining ? `= restants **${troopsLine(remaining)}**` : '⚠️ Troupes illisibles : enregistre-les avec `!armee`.',
  ].join('\n');
}

/** Niveaux de `!niveaux <joueur> <CE> <académie> <chunin> <jounin> <mur> <hôpital>` vers les champs de la base. */
export const toPlayerLevels = (levels: MemberLevels): PlayerLevels => ({
  ...(levels.ce !== undefined ? { ce: levels.ce } : {}),
  ...(levels.academy !== undefined ? { academy: levels.academy } : {}),
  ...(levels.chunnin !== undefined ? { chunninCenter: levels.chunnin } : {}),
  ...(levels.jounin !== undefined ? { jouninCenter: levels.jounin } : {}),
  ...(levels.wall !== undefined ? { wall: levels.wall } : {}),
  ...(levels.hospital !== undefined ? { hospital: levels.hospital } : {}),
});

/** `!commentaire <joueur> : <texte>` → joueur et texte (texte vide = supprimer) ; null sans « : ». */
export function splitComment(query: string): { player: string; text: string } | null {
  const m = /^(.+?)\s*[:|]\s*([\s\S]*)$/.exec(query.trim());
  return m && m[1].trim() ? { player: m[1].trim(), text: m[2].trim() } : null;
}
