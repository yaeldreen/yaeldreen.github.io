import type { ImportedVillage } from './map-import.js';
import { parisParts } from '../shared/paris-time.js';

/** Points et habitants d'un joueur à une date (clés courtes : le document garde tous les joueurs). */
export interface SnapshotPlayer {
  /** Joueur (kage) */ n: string;
  /** Clan */ c: string | null;
  /** Points */ p: number;
  /** Habitants */ h: number;
}

/** Relevé mensuel : « current » (mois en cours) et « previous » (mois précédent) dans la collection `snapshots`. */
export interface MonthlySnapshot {
  /** "2026-11" */ month: string;
  takenAt: string;
  players: SnapshotPlayer[];
}

export type SnapshotSlot = 'current' | 'previous';

/** Mois à l'heure de Paris (le serveur du bot peut être dans un autre fuseau). */
export const monthKey = (date: Date): string => {
  const p = parisParts(date.getTime());
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
};

/** "2026-11" → "1er novembre 2026". */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `1er ${new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} ${year}`;
}

/** Le relevé se fait le 1er du mois, une seule fois (le premier import du jour). */
export const isSnapshotDue = (now: Date, current: MonthlySnapshot | null): boolean =>
  parisParts(now.getTime()).day === 1 && current?.month !== monthKey(now);

/** Joueurs de la carte (villages neutres exclus), triés par nom. */
export function buildSnapshot(villages: readonly ImportedVillage[], now: Date): MonthlySnapshot {
  return {
    month: monthKey(now),
    takenAt: now.toISOString(),
    players: villages
      .filter((v) => !v.neutral)
      .map((v) => ({ n: v.kage, c: v.clan, p: v.points, h: v.inhabitants }))
      .sort((a, b) => a.n.localeCompare(b.n, 'fr')),
  };
}

export interface EvolutionRow {
  name: string;
  clan: string | null;
  points: number;
  /** null : joueur absent du mois précédent. */ previousPoints: number | null;
  pointsDelta: number | null;
  inhabitants: number;
  previousInhabitants: number | null;
  inhabitantsDelta: number | null;
}

/** Évolution de chaque joueur du mois en cours par rapport au mois précédent. */
export function compareSnapshots(previous: MonthlySnapshot | null, current: MonthlySnapshot): EvolutionRow[] {
  const before = new Map((previous?.players ?? []).map((p) => [p.n, p]));
  return current.players.map((p) => {
    const old = before.get(p.n);
    return {
      name: p.n,
      clan: p.c,
      points: p.p,
      previousPoints: old?.p ?? null,
      pointsDelta: old ? p.p - old.p : null,
      inhabitants: p.h,
      previousInhabitants: old?.h ?? null,
      inhabitantsDelta: old ? p.h - old.h : null,
    };
  });
}
