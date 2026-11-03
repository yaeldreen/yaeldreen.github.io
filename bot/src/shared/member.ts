import { findPlayer, findVillage, gameData, getProfile, KnownPlayer, MemberProfile, updateProfile } from '../game-data.js';
import { OWN_CLAN } from '../gestion-joueurs/store.js';
import { SendableMessage } from './conversation.js';
import { matchPlayer } from './member-link.js';

/** Réglages du joueur relié : son nom et son village sur la carte. */
export function linkFor(player: KnownPlayer): MemberProfile {
  const village = findVillage(player.village) ?? findVillage(player.name);
  return { player: player.name, village: village?.name ?? player.village };
}

/** Joueur désigné par son nom ou son village (liste des joueurs, sinon carte). */
export function playerFromQuery(query: string): KnownPlayer | null {
  const direct = findPlayer(query);
  if (direct) return direct;
  const village = findVillage(query);
  return village && !village.neutral ? (findPlayer(village.kage) ?? { name: village.kage, village: village.name, clan: village.clan }) : null;
}

/**
 * Réglages du membre qui a écrit le message. S'il n'est relié à aucun joueur, on essaie avec ses pseudos
 * (serveur, affichage, utilisateur) ; la liaison trouvée est enregistrée et annoncée une fois.
 */
export async function memberProfile(message: SendableMessage): Promise<MemberProfile> {
  const profile = await getProfile(message.author.id);
  if (profile.player || profile.village) return profile;
  const names = [message.member?.nickname, message.member?.displayName, message.author.globalName, message.author.username];
  const player = matchPlayer(names, gameData.players, OWN_CLAN);
  if (!player) return profile;
  const linked = await updateProfile(message.author.id, linkFor(player));
  await message.channel.send(
    `🔗 ${message.author}, je t'ai relié à **${player.name}** (village ${linked.village}) d'après ton pseudo. ` +
      'Si ce n’est pas toi, demande à un éditeur `!lier @toi <ton joueur>` dans #gestion-joueurs.',
  );
  return linked;
}
