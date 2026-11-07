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

/** Message envoyé par le script du classement (public/classement-table-ronde.user.js), ou copié par lui. */
export const RANKING_MESSAGE = 'table-ronde:classement';

/** Origine du jeu : seule source acceptée pour un relevé. */
export const GAME_ORIGIN = 'https://worldofshinobi.com';

/** Page du classement des joueurs ; l'ancre demande au script de tout relever. */
export const RANKING_PAGE_URL = `${GAME_ORIGIN}/classements.html?vue=joueurs#table-ronde`;

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const count = (value: unknown): number => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Relevé à partir du message du script : `{ type, takenAt, players }`, chaque joueur tel que l'API du classement le donne
 * (`id`, `kage`, `name` = village, `clan` = `{ name }` ou null, `points`, `inhabitants`). `null` si le message n'a pas cette forme.
 */
export function readRankingMessage(data: unknown, now: Date): PlayersSnapshot | null {
  const message = data as { type?: unknown; takenAt?: unknown; players?: unknown } | null;
  if (message?.type !== RANKING_MESSAGE || !Array.isArray(message.players) || !message.players.length) return null;
  const players: SnapshotPlayer[] = [];
  for (const row of message.players as Record<string, unknown>[]) {
    const clan = row?.['clan'] as { name?: unknown } | null | undefined;
    if (typeof row?.['kage'] !== 'string' || (clan != null && typeof clan.name !== 'string')) return null;
    players.push({
      ...(Number.isInteger(row['id']) ? { i: row['id'] as number } : {}),
      n: row['kage'].trim(),
      v: typeof row['name'] === 'string' ? row['name'].trim() : '',
      c: clan ? (clan.name as string).trim() : null,
      p: count(row['points']),
      h: count(row['inhabitants']),
    });
  }
  const takenAt = typeof message.takenAt === 'string' && !Number.isNaN(Date.parse(message.takenAt)) ? new Date(message.takenAt) : now;
  return { month: monthKey(takenAt), takenAt: takenAt.toISOString(), players };
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
