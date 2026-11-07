import { GAME_ORIGIN } from '../players-update/ranking-snapshot';

/** Attaque d'un village neutre, relevée dans son « Historique des attaques » du jeu. */
export interface NeutralRaid {
  /** Identifiant du village neutre (négatif) */ village: number;
  villageName: string;
  attacker: string;
  /** Village de l'attaquant, pour le retrouver malgré un renommage */ attackerVillageId: number;
  mode: 'pillage' | 'attaque';
  /** Date ISO de l'impact */ at: string;
}

/** Message envoyé par le script des pillages (public/pillages-table-ronde.user.js), ou copié par lui. */
export const RAIDS_MESSAGE = 'table-ronde:pillages';

/** Une actualisation par heure au plus, pour tout le clan (contrôlé aussi par les règles Firestore). */
export const REFRESH_INTERVAL_MS = 3_600_000;

/** Page d'un village neutre ; l'ancre donne au script la liste des villages à relever. */
export const raidsPageUrl = (villageIds: readonly number[]): string =>
  `${GAME_ORIGIN}/joueur.html?id=${villageIds[0]}#table-ronde-pillages=${villageIds.join(',')}`;

/** Identifiant du document : la même attaque relevée deux fois ne s'enregistre qu'une fois. */
export const raidId = ({ village, at, attackerVillageId }: NeutralRaid): string => `${village}_${Date.parse(at)}_${attackerVillageId}`;

/**
 * Attaques du message du script : `{ type, villages: [{ id, name, history }] }`, chaque attaque telle que l'API du jeu la donne
 * (`attacker`, `attackerVillageId`, `mode`, `createdAt`). Les lignes illisibles sont ignorées ; `null` si le message n'a pas cette forme.
 */
export function readRaidsMessage(data: unknown): NeutralRaid[] | null {
  const message = data as { type?: unknown; villages?: unknown } | null;
  if (message?.type !== RAIDS_MESSAGE || !Array.isArray(message.villages)) return null;
  const raids: NeutralRaid[] = [];
  for (const village of message.villages as { id?: unknown; name?: unknown; history?: unknown }[]) {
    if (!Number.isInteger(village?.id) || !Array.isArray(village.history)) continue;
    for (const event of village.history as Record<string, unknown>[]) {
      const at = new Date(event?.['createdAt'] as string | number);
      if (typeof event?.['attacker'] !== 'string' || !Number.isInteger(event['attackerVillageId']) || Number.isNaN(at.getTime())) continue;
      raids.push({
        village: village.id as number,
        villageName: typeof village.name === 'string' ? village.name.trim() : '',
        attacker: event['attacker'].trim(),
        attackerVillageId: event['attackerVillageId'] as number,
        mode: event['mode'] === 'pillage' ? 'pillage' : 'attaque',
        at: at.toISOString(),
      });
    }
  }
  return raids;
}

/** Attaques pas encore en base (et sans doublon dans le relevé lui-même). */
export function newRaids(raids: readonly NeutralRaid[], known: ReadonlySet<string>): NeutralRaid[] {
  const seen = new Set(known);
  return raids.filter((raid) => {
    const id = raidId(raid);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Attaques de la plus récente à la plus ancienne, éventuellement d'un seul village. */
export function sortedRaids(raids: readonly NeutralRaid[], village: number | null = null): NeutralRaid[] {
  return raids.filter((raid) => village === null || raid.village === village).sort((a, b) => b.at.localeCompare(a.at) || a.attacker.localeCompare(b.attacker, 'fr'));
}

/** Villages ayant au moins une attaque relevée, par nom : les choix du filtre. */
export function raidedVillages(raids: readonly NeutralRaid[]): { id: number; name: string }[] {
  const names = new Map<number, string>();
  for (const raid of raids) if (!names.get(raid.village)) names.set(raid.village, raid.villageName || String(raid.village));
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

const PARIS_DATE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Date et heure d'impact, heure de Paris comme dans le jeu : "07/11/2026 14:04". */
export const raidTime = (iso: string): string => PARIS_DATE.format(new Date(iso)).replace(',', '');

/** Heure (ms) à partir de laquelle une nouvelle actualisation est permise ; `null` : tout de suite. */
export const nextRefreshAt = (lastRefresh: number | null, now: number): number | null =>
  lastRefresh !== null && now < lastRefresh + REFRESH_INTERVAL_MS ? lastRefresh + REFRESH_INTERVAL_MS : null;
