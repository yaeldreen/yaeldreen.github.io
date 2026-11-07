import { VillageDoc } from '../../core/game-data/map-villages';
import { Player, PLAYER_STATS, PlayerStatKey } from '../enemies/clans.data';
import { EnemyRecord, playerKey, TROOPS, TroopCounts, TroopKey } from '../enemies/enemies.model';
import { compareSnapshots, EvolutionRow, PlayersSnapshot } from '../players-update/ranking-snapshot';

export interface PlayerSheet {
  player: Player;
  /** Son document de `villages`, pour les coordonnées et l'identifiant du jeu. */ village: VillageDoc | null;
  record: EnemyRecord | null;
  /** Évolution depuis le relevé précédent du classement, s'il existe. */ evolution: EvolutionRow | null;
}

/** Tout ce que la base sait d'un joueur, retrouvé par son nom (sans tenir compte de la casse). */
export function playerSheet(
  name: string,
  players: readonly Player[],
  villages: readonly VillageDoc[],
  records: Readonly<Record<string, EnemyRecord>>,
  snapshots: { previous: PlayersSnapshot | null; current: PlayersSnapshot | null },
): PlayerSheet | null {
  const key = playerKey(name);
  const player = players.find((p) => playerKey(p.name) === key);
  if (!player) return null;
  const rows = snapshots.current ? compareSnapshots(snapshots.previous, snapshots.current) : [];
  return {
    player,
    village: villages.find((v) => !v.neutral && playerKey(v.kage) === key) ?? null,
    record: records[key] ?? null,
    evolution: rows.find((r) => playerKey(r.name) === key) ?? null,
  };
}

/** Âge en jours entiers, pour juger de la fraîcheur d'une information. */
export const ageInDays = (iso: string, now: number): number => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));

const PHOTO_SIZE = 128;

/** Photo de profil du joueur sur le site du jeu. */
export const profilePhotoUrl = (gameId: number | undefined): string | null =>
  gameId !== undefined && gameId > 0 ? `https://worldofshinobi.com/api/profile-logo?id=${gameId}&size=${PHOTO_SIZE}` : null;

/** Sans photo, le jeu renvoie son image par défaut (150 px), plus grande que la taille demandée pour une vraie photo. */
export const isDefaultPhoto = (width: number, height: number): boolean => width > PHOTO_SIZE || height > PHOTO_SIZE;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date de création telle qu'affichée dans le formulaire : JJ/MM/AAAA HH:MM. */
export function formatCreatedAt(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lit un timestamp du jeu (en millisecondes ou en secondes) ou une date JJ/MM/AAAA [HH:MM]. `null` si illisible. */
export function parseCreatedAt(text: string): string | null {
  const value = text.trim();
  if (/^\d{13}$/.test(value)) return new Date(Number(value)).toISOString();
  if (/^\d{10}$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:h](\d{2}))?$/.exec(value);
  if (!m) return null;
  const [day, month, year, hours, minutes] = m.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hours, minutes);
  // Un 31/02 ou un 25:00 passerait au jour suivant sans rien dire.
  return date.getDate() === day && date.getMonth() === month - 1 && date.getHours() === hours && date.getMinutes() === minutes ? date.toISOString() : null;
}

/** Ce qui change : le texte préaffiché ne touche pas à la date (il n'a pas les secondes), une saisie illisible n'est pas enregistrée. */
function createdAtChange(current: string | undefined, text: string): string | null {
  const value = text.trim();
  if (value === formatCreatedAt(current)) return null;
  return value ? parseCreatedAt(value) : '';
}

/** La saisie peut être enregistrée : vide ou lisible. */
export const isCreatedAtValid = (text: string): boolean => !text.trim() || parseCreatedAt(text) !== null;

/** Saisie de la fiche ; un champ vide vaut `null`. */
export interface SheetForm {
  stats: Record<PlayerStatKey, number | null>;
  troops: Record<TroopKey, number | null>;
  /** Date de création du compte telle que saisie, vide si inconnue. */ createdAt: string;
  comment: string;
}

export function sheetForm({ player, record }: PlayerSheet): SheetForm {
  return {
    stats: Object.fromEntries(PLAYER_STATS.map((f) => [f.key, player[f.key] ?? null])) as SheetForm['stats'],
    troops: Object.fromEntries(TROOPS.map((t) => [t.key, record?.troops[t.key] ?? null])) as SheetForm['troops'],
    createdAt: formatCreatedAt(player.createdAt),
    comment: player.comment ?? '',
  };
}

export interface SheetChanges {
  stats: Partial<Record<PlayerStatKey, number | null>>;
  /** Nouvelles troupes, si elles changent. */ troops: TroopCounts | null;
  /** Nouvelle date de création (ISO), si elle change ; vide pour l'effacer. */ createdAt: string | null;
  /** Nouveau commentaire, si il change ; vide pour l'effacer. */ comment: string | null;
}

const toCount = (value: number | null): number => Math.max(0, Math.floor(Number(value) || 0));

/** Ce qui change par rapport à la base. Une troupe vide compte pour 0 dès qu'une autre est remplie. */
export function sheetChanges({ player, record }: PlayerSheet, form: SheetForm): SheetChanges {
  const stats: SheetChanges['stats'] = {};
  for (const { key, max } of PLAYER_STATS) {
    const value = form.stats[key] === null ? null : max ? Math.min(max, toCount(form.stats[key])) : toCount(form.stats[key]);
    // Les points et habitants viennent de la carte : un champ vide ne les efface pas.
    if (value === null && !max) continue;
    if (value !== (player[key] ?? null)) stats[key] = value;
  }
  const filled = TROOPS.some((t) => form.troops[t.key] !== null);
  const troops = Object.fromEntries(TROOPS.map((t) => [t.key, toCount(form.troops[t.key])])) as TroopCounts;
  const troopsChanged = filled && TROOPS.some((t) => troops[t.key] !== record?.troops[t.key]);
  const comment = form.comment.trim();
  return {
    stats,
    troops: troopsChanged ? troops : null,
    createdAt: createdAtChange(player.createdAt, form.createdAt),
    comment: comment !== (player.comment ?? '') ? comment : null,
  };
}

export const hasChanges = ({ stats, troops, createdAt, comment }: SheetChanges): boolean =>
  Object.keys(stats).length > 0 || troops !== null || createdAt !== null || comment !== null;
