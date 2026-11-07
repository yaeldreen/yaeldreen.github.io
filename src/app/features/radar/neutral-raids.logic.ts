/** Attaque d'un village neutre, relevée dans son « Historique des attaques » du jeu. */
export interface NeutralRaid {
  /** Identifiant du village neutre (négatif) */ village: number;
  villageName: string;
  attacker: string;
  /** Village de l'attaquant, pour le retrouver malgré un renommage */ attackerVillageId: number;
  mode: 'pillage' | 'attaque';
  /** Date ISO de l'impact */ at: string;
}

/**
 * Lit l'« Historique des attaques » collé : une liste d'attaques telle que le jeu la donne
 * (`attacker`, `attackerVillageId`, `target`, `targetVillageId`, `mode`, `createdAt`). Les attaques visant un village de joueur
 * (identifiant positif) sont écartées et comptées dans `ignored`. Lève une erreur lisible si le texte n'a pas cette forme.
 */
export function parseRaidsExport(text: string): { raids: NeutralRaid[]; ignored: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Le texte collé n'est pas du JSON valide (copie coupée ?).");
  }
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { history?: unknown })?.history) ? (raw as { history: unknown[] }).history : null;
  if (!list) throw new Error("Collez une liste d'attaques (de « [ » à « ] »).");
  const raids: NeutralRaid[] = [];
  let ignored = 0;
  list.forEach((event: Record<string, unknown>, i) => {
    const at = new Date(event?.['createdAt'] as string | number);
    if (typeof event?.['attacker'] !== 'string' || !Number.isInteger(event['attackerVillageId']) || !Number.isInteger(event['targetVillageId']) || Number.isNaN(at.getTime())) {
      throw new Error(`Attaque n°${i + 1} illisible (attaquant, village ou date manquant).`);
    }
    if ((event['targetVillageId'] as number) >= 0) {
      ignored++;
      return;
    }
    raids.push({
      village: event['targetVillageId'] as number,
      villageName: typeof event['target'] === 'string' ? event['target'].trim() : '',
      attacker: event['attacker'].trim(),
      attackerVillageId: event['attackerVillageId'] as number,
      mode: event['mode'] === 'pillage' ? 'pillage' : 'attaque',
      at: at.toISOString(),
    });
  });
  return { raids, ignored };
}

/** Identifiant du document : la même attaque collée deux fois ne s'enregistre qu'une fois. */
export const raidId = ({ village, at, attackerVillageId }: NeutralRaid): string => `${village}_${Date.parse(at)}_${attackerVillageId}`;

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
