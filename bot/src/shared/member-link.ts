/** Rapprochement d'un membre Discord et d'un joueur du jeu, d'après son pseudo. */

export interface LinkCandidate {
  name: string;
  village: string;
  clan: string | null;
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

/**
 * Joueur dont le nom ou le village correspond à l'un des pseudos du membre (pseudo du serveur, nom d'affichage,
 * nom d'utilisateur), accents, majuscules et émojis ignorés. En cas de doublon, le membre du clan l'emporte ;
 * s'il reste plusieurs candidats, on ne devine pas (null).
 */
export function matchPlayer<T extends LinkCandidate>(names: readonly (string | null | undefined)[], players: readonly T[], ownClan: string): T | null {
  for (const raw of names) {
    const target = raw ? normalize(raw) : '';
    if (!target) continue;
    const matches = players.filter((p) => normalize(p.name) === target || normalize(p.village) === target);
    const ours = matches.filter((p) => p.clan === ownClan);
    const pick = ours.length ? ours : matches;
    if (pick.length === 1) return pick[0];
  }
  return null;
}
