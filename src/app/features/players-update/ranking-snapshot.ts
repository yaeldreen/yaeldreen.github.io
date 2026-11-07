import { RankingEntry } from '../../core/game-data/map-villages';

/** Points et habitants d'un joueur à une date (clés courtes : le document garde tous les joueurs). */
export interface SnapshotPlayer {
  /** Identifiant du joueur dans le jeu (absent des anciens relevés) */ i?: number;
  /** Joueur (kage) */ n: string;
  /** Village (absent des anciens relevés) */ v?: string;
  /** Clan */ c: string | null;
  /** Points */ p: number;
  /** Habitants */ h: number;
}

/** Relevé du classement : « current » (dernier) et « previous » (celui d'avant) dans la collection `snapshots`. */
export interface PlayersSnapshot {
  /** "2026-11" : exigé par les règles Firestore publiées, sans autre usage. */ month: string;
  /** Date et heure ISO du relevé */ takenAt: string;
  players: SnapshotPlayer[];
}

export type SnapshotSlot = 'current' | 'previous';

/** Pages du classement collées à moins de 30 min d'écart : elles complètent le même relevé au lieu d'en commencer un nouveau. */
export const SAME_SNAPSHOT_MS = 30 * 60_000;

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const toPlayer = (entry: RankingEntry): SnapshotPlayer => ({
  ...(entry.gameId !== undefined ? { i: entry.gameId } : {}),
  n: entry.kage,
  v: entry.name,
  c: entry.clan,
  p: entry.points,
  h: entry.inhabitants,
});

/** Relevé du classement collé dans « Liste des joueurs (JSON) ». */
export const snapshotFromRanking = (ranking: readonly RankingEntry[], now: Date): PlayersSnapshot => ({
  month: monthKey(now),
  takenAt: now.toISOString(),
  players: ranking.map(toPlayer),
});

/**
 * Où ranger un nouveau collage du classement. Moins de 30 min après le relevé « maintenant », c'est une autre page du même
 * classement : ses joueurs complètent ce relevé (et remplacent leurs anciennes valeurs). Sinon, c'est un nouveau relevé.
 */
export function placeRanking(current: PlayersSnapshot | null, ranking: readonly RankingEntry[], now: Date): { snapshot: PlayersSnapshot; rotate: boolean } {
  if (!current || now.getTime() - Date.parse(current.takenAt) >= SAME_SNAPSHOT_MS) return { snapshot: snapshotFromRanking(ranking, now), rotate: true };
  const incoming = ranking.map(toPlayer);
  const ids = new Set(incoming.flatMap((p) => (p.i !== undefined ? [p.i] : [])));
  const names = new Set(incoming.map((p) => p.n));
  const kept = current.players.filter((p) => !(p.i !== undefined ? ids.has(p.i) : names.has(p.n)));
  return { snapshot: { ...current, players: [...kept, ...incoming] }, rotate: false };
}

/** Date et heure d'un relevé : "07/11/2026 14:32". */
export const snapshotLabel = (snapshot: PlayersSnapshot): string =>
  new Date(snapshot.takenAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export interface EvolutionRow {
  name: string;
  village: string | null;
  clan: string | null;
  points: number;
  /** null : joueur absent du relevé précédent. */ previousPoints: number | null;
  pointsDelta: number | null;
  inhabitants: number;
  previousInhabitants: number | null;
  inhabitantsDelta: number | null;
}

/** Chaque joueur du dernier relevé, face au relevé précédent (retrouvé par son identifiant du jeu, sinon par son nom). */
export function compareSnapshots(previous: PlayersSnapshot | null, current: PlayersSnapshot): EvolutionRow[] {
  const before = previous?.players ?? [];
  const byId = new Map(before.flatMap((p) => (p.i !== undefined ? [[p.i, p]] : [])));
  const byName = new Map(before.map((p) => [p.n, p]));
  return current.players.map((p) => {
    const old = (p.i !== undefined ? byId.get(p.i) : undefined) ?? byName.get(p.n);
    return {
      name: p.n,
      village: p.v || null,
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

export interface EvolutionSort {
  key: 'points' | 'inhabitants';
  direction: 'asc' | 'desc';
}

/** Tri sur les valeurs actuelles ; à égalité, par nom. */
export function sortEvolution(rows: readonly EvolutionRow[], { key, direction }: EvolutionSort): EvolutionRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * (a[key] - b[key]) || a.name.localeCompare(b.name, 'fr'));
}

/** Clic sur une colonne : la colonne déjà triée change de sens, une autre commence par le plus grand. */
export const toggleSort = (sort: EvolutionSort, key: EvolutionSort['key']): EvolutionSort =>
  sort.key === key ? { key, direction: sort.direction === 'desc' ? 'asc' : 'desc' } : { key, direction: 'desc' };
