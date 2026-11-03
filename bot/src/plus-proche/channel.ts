import { EmbedBuilder } from 'discord.js';
import { findVillage, gameData, linkedProfiles, MapVillage, MemberProfile, playerKey } from '../game-data.js';
import { OWN_CLAN } from '../gestion-joueurs/store.js';
import { SendableMessage } from '../shared/conversation.js';
import { formatDuration, num } from '../shared/format.js';
import { pickVillage } from '../shared/pick-village.js';
import { travelMs } from '../retours/travel.js';
import { clanVillages, rankClanMembers } from './nearest.js';

const COLOR = 0x7c3aed;
/** Membres affichés par défaut (tout le clan tient en général dans une fiche). */
const DEFAULT_SHOWN = 25;

/** Membres en train de choisir un village. */
const busy = new Set<string>();

const HELP = [
  `**Qui est le plus proche** — membres de ${OWN_CLAN} classés par distance d’un village :`,
  '`!proche <village ou joueur>` : ex. `!proche Reggaeton`, `!proche Jakojak`',
  '`!proche <village> <nombre>` : seulement les plus proches, ex. `!proche Reggaeton 5`',
  '`!proche` seul : le bot te fait chercher et choisir le village dans une liste',
  'Le temps de trajet s’affiche pour les membres qui ont donné leur CE (`!mesNiveaux` dans #gestion-joueurs).',
].join('\n');

export async function handlePlusProche(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!proche':
      return nearest(message, rest);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

async function nearest(message: SendableMessage, args: string[]): Promise<void> {
  const count = args.length > 1 && /^\d{1,2}$/.test(args[args.length - 1]) ? Number(args.pop()) : DEFAULT_SHOWN;
  const query = args.join(' ').trim();
  if (!gameData.villages.length) return void (await message.reply('La carte est vide : fais `!majJoueurs` dans #gestion-joueurs.'));
  // « !proche » seul : on fait chercher et choisir le village visé dans une liste.
  let target: MapVillage | null;
  if (query) {
    target = findVillage(query);
    if (!target) return void (await message.reply(`« ${query} » n'est pas sur la carte (nom du village ou du joueur).`));
  } else {
    if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
    busy.add(message.author.id);
    try {
      target = await pickVillage(message, 'visé');
    } finally {
      busy.delete(message.author.id);
    }
    if (!target) return;
  }

  const members = clanVillages(gameData.villages, OWN_CLAN);
  if (!members.length) return void (await message.reply(`Aucun village de ${OWN_CLAN} sur la carte : fais \`!majJoueurs\` dans #gestion-joueurs.`));
  const ranked = rankClanMembers(target, members).slice(0, Math.max(1, count));

  // Membres Discord reliés : leur nom apparaît (sans notification) et leur CE donne le temps de trajet.
  const linked = new Map<string, { userId: string; profile: MemberProfile }>(
    (await linkedProfiles()).filter((m) => m.profile.player).map((m) => [playerKey(m.profile.player!), m]),
  );
  const travel = gameData.travel;
  const lines = ranked.map(({ village, distance }, i) => {
    const member = linked.get(playerKey(village.kage));
    const ce = member?.profile.ce;
    const time =
      travel && ce
        ? ` · ⏱️ ${formatDuration(travelMs(travel, distance, ce) / 1000)} · 🎟️ ${formatDuration(travelMs(travel, distance, ce, true) / 1000)} (CE ${ce})`
        : '';
    const who = member ? ` <@${member.userId}>` : '';
    return `**${i + 1}.** ${village.kage}${who} — ${village.name} · **${num(distance).replace('.', ',')} km**${time}`;
  });

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`📍 Plus proches de ${target.name}`)
        .setDescription([`🎯 ${target.name} (${target.kage}${target.clan ? `, ${target.clan}` : ''}) · ${target.x} / ${target.y}`, '', ...lines].join('\n').slice(0, 4000))
        .setFooter({ text: '⏱️ trajet sans ticket · 🎟️ avec ticket vitesse · distances au demi-km' }),
    ],
    allowedMentions: { parse: [] },
  });
}
