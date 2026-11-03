import { ActionRowBuilder, Attachment, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Message, MessageFlags } from 'discord.js';
import { config } from '../config.js';
import { findPlayer, gameData, getProfile, linkedProfiles, playerKey, unlinkProfile, updateProfile } from '../game-data.js';
import { ask, hasEditorRole, isCancel, nextMessage, SendableMessage } from '../shared/conversation.js';
import { linkFor, playerFromQuery } from '../shared/member.js';
import { LEVEL_ORDER, levelOfCommand, levelsSummary, parseAllLevels, parseOneLevel } from '../shared/member-levels.js';
import { ceSkipped, refreshedNote, refreshRecent } from '../retours/channel.js';
import { num } from '../shared/format.js';
import { ImportedVillage, parseMapExport, parseNeutralExport } from './map-import.js';
import { monthLabel } from './monthly-snapshot.js';
import { deletePlayer, importMap, importNeutralVillages, snapshotIfDue } from './store.js';

const COLOR = 0x4d7c0f;

const HELP = [
  '**Gestion joueurs** :',
  '`!lier @membre <joueur ou village>` : relie un membre Discord à son joueur (rôle « ' + config.editorRole + ' »)',
  '`!delier @membre` : retire la liaison · `!liens` : membres reliés',
  '',
  '**Tes niveaux** (retours, simulations) :',
  '`!mesNiveaux <CE> <académie> <chunin> <jounin> <mur> <hôpital>` : tout d’un coup, ex. `!mesNiveaux 11 8 8 5 7 3` (`?` = inchangé)',
  `Un seul : ${LEVEL_ORDER.map((l) => `\`${l.command} <niveau>\``).join(', ')}`,
  '`!mesNiveaux` : voir ta liaison et tes niveaux',
  '',
  '`!supprimerJoueur <joueur ou village>` : supprime un joueur et son armée connue (rôle « ' + config.editorRole + ' »)',
  '`!majJoueurs` + fichier de la liste des joueurs (JSON « [ … ] ») : met à jour joueurs, villages et clans',
  '`!majNeutres` + fichier de la liste compacte (`{ 0: …, 9: true }`) : met à jour les villages neutres',
  '-# Une liste trop longue pour un message : colle-la quand même, Discord en fait un fichier `message.txt`, ou joins le fichier.',
  '-# Les membres sont aussi reliés automatiquement quand leur pseudo correspond à un joueur ou un village.',
].join('\n');

/** Membres en train d'envoyer un fichier au bot. */
const busy = new Set<string>();

export async function handleGestionJoueurs(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!lier':
      return link(message, rest.join(' '));
    case '!delier':
      return unlink(message);
    case '!liens':
      return listLinks(message);
    case '!supprimerjoueur':
      return removePlayer(message, rest.join(' '));
    case '!majjoueurs':
      return importFile(message, 'players');
    case '!majneutres':
      return importFile(message, 'neutral');
    case '!mesniveaux':
      return setAllLevels(message, rest);
    case '!aide':
      await message.reply(HELP);
      return;
  }
  const level = levelOfCommand(command);
  if (level) return setOneLevel(message, level, rest.join(' '));
}

/** Combien de temps le bouton « Voir mes infos » reste dans le salon. */
const BUTTON_TTL_MS = 60_000;

/** Supprime la commande du membre (ses niveaux n'ont pas à rester affichés dans le salon). */
const deleteCommand = (message: SendableMessage): Promise<unknown> => message.delete().catch(() => undefined);

/** Infos d'un membre : joueur relié, village et niveaux. */
async function myInfos(userId: string): Promise<string> {
  const p = await getProfile(userId);
  return (
    `Joueur relié : **${p.player ?? 'aucun'}**${p.village ? ` (village ${p.village})` : ''}\nNiveaux : ${levelsSummary({ ...p, ce: p.ce })}` +
    '\n-# `!mesNiveaux 11 8 8 5 7 3` pour tout changer, ou une commande par bâtiment (`!aide`).'
  );
}

/**
 * `!mesNiveaux` seul : une commande « ! » ne peut pas répondre en privé dans le salon, un bouton si.
 * On supprime la commande et on pose un bouton ; le clic affiche les infos de celui qui clique, visibles par lui seul.
 */
async function showMine(message: SendableMessage): Promise<void> {
  await deleteCommand(message);
  const prompt = await message.channel.send({
    content: `${message.author} tes infos, visibles par toi seul :`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('gestion:moi').setLabel('👁️ Voir mes infos').setStyle(ButtonStyle.Primary),
      ),
    ],
    allowedMentions: { users: [message.author.id] },
  });
  setTimeout(() => void prompt.delete().catch(() => undefined), BUTTON_TTL_MS);
}

/** Clic sur « Voir mes infos » : réponse visible uniquement par la personne qui clique. */
export async function handleGestionInteraction(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== 'gestion:moi') return;
  await interaction.reply({ content: await myInfos(interaction.user.id), flags: MessageFlags.Ephemeral });
}

/**
 * Enregistre des niveaux du membre, supprime sa commande et le mentionne simplement ;
 * met à jour ses fiches de retours si son CE a changé.
 */
async function saveLevels(message: SendableMessage, levels: Partial<Record<(typeof LEVEL_ORDER)[number]['key'], number>>): Promise<void> {
  const before = await getProfile(message.author.id);
  await updateProfile(message.author.id, levels);
  let note = '';
  if (levels.ce !== undefined) {
    ceSkipped.delete(message.author.id);
    if (levels.ce !== before.ce) note = refreshedNote(await refreshRecent(message.author.id));
  }
  await deleteCommand(message);
  await message.channel.send({ content: `${message.author} ✅ Tes infos sont à jour.${note}`, allowedMentions: { users: [message.author.id] } });
}

async function setAllLevels(message: SendableMessage, args: string[]): Promise<void> {
  if (!args.length) return showMine(message);
  const parsed = parseAllLevels(args);
  if ('error' in parsed) return void (await message.reply(parsed.error));
  await saveLevels(message, parsed.levels);
}

async function setOneLevel(message: SendableMessage, key: (typeof LEVEL_ORDER)[number]['key'], text: string): Promise<void> {
  const { label, command } = LEVEL_ORDER.find((l) => l.key === key)!;
  const value = parseOneLevel(text);
  if (value === null) return void (await message.reply(`Précise un niveau de 0 à 20 : \`${command} 8\` (${label}).`));
  await saveLevels(message, { [key]: value });
}

async function requireEditor(message: SendableMessage): Promise<boolean> {
  if (hasEditorRole(message)) return true;
  await message.reply(`Seuls les membres avec le rôle « ${config.editorRole} » peuvent faire ça.`);
  return false;
}

async function link(message: SendableMessage, query: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  const member = message.mentions.members?.first();
  const name = query.replace(/<@!?\d+>/g, '').trim();
  if (!member || !name) return void (await message.reply('Ex. : `!lier @Nico Serpent` (nom du joueur ou de son village).'));
  const player = playerFromQuery(name);
  if (!player) return void (await message.reply(`« ${name} » n'est ni un joueur connu ni un village de la carte.`));
  const profile = await updateProfile(member.id, linkFor(player));
  await message.reply(`🔗 ${member} est relié à **${player.name}** (village ${profile.village}).`);
}

async function unlink(message: SendableMessage): Promise<void> {
  if (!(await requireEditor(message))) return;
  const member = message.mentions.members?.first();
  if (!member) return void (await message.reply('Ex. : `!delier @Nico`.'));
  const before = await getProfile(member.id);
  await unlinkProfile(member.id);
  await message.reply(before.player ? `${member} n'est plus relié à ${before.player}.` : `${member} n'était relié à aucun joueur.`);
}

async function listLinks(message: SendableMessage): Promise<void> {
  const links = await linkedProfiles();
  if (!links.length) return void (await message.reply('Aucun membre relié pour l’instant.'));
  const lines = links.map(({ userId, profile }) => `<@${userId}> → **${profile.player ?? '?'}** (${profile.village ?? '?'})${profile.ce ? ` · CE ${profile.ce}` : ''}`);
  await message.reply({
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle(`🔗 Membres reliés (${links.length})`).setDescription(lines.join('\n').slice(0, 4000))],
    allowedMentions: { parse: [] },
  });
}

const textFileOf = (m: Message): Attachment | undefined =>
  m.attachments.find((a) => /\.(json|txt|js)$/i.test(a.name) || (a.contentType?.startsWith('text/') ?? false) || (a.contentType?.includes('json') ?? false));

/** Texte de l'export : fichier joint (ou message.txt créé par Discord), sinon texte collé après la commande, sinon demandé. */
async function exportText(message: SendableMessage): Promise<string | null> {
  const inline = message.content.replace(/^\s*!\S+/, '').trim();
  const attached = textFileOf(message);
  if (attached) return (await fetch(attached.url)).text();
  if (inline) return inline;
  await message.channel.send(`${message.author} Envoie la liste (colle-la ou joins le fichier).\n-# Ou \`annuler\`.`);
  const reply = await nextMessage(message);
  if (!reply) return null;
  const file = textFileOf(reply);
  if (file) return (await fetch(file.url)).text();
  if (isCancel(reply.content)) {
    await message.channel.send('Annulé.');
    return null;
  }
  return reply.content;
}

async function importFile(message: SendableMessage, kind: 'players' | 'neutral'): Promise<void> {
  if (!(await requireEditor(message))) return;
  if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà un envoi en cours : termine-le ou réponds `annuler`.'));
  busy.add(message.author.id);
  try {
    const text = await exportText(message);
    if (text === null) return;
    let villages: ImportedVillage[];
    try {
      villages = kind === 'players' ? parseMapExport(text) : parseNeutralExport(text);
    } catch (error) {
      return void (await message.channel.send(`❌ ${(error as Error).message}`));
    }
    if (kind === 'neutral' && !villages.length) return void (await message.channel.send('❌ Aucun village neutre (`9: true`) dans la liste.'));

    await message.channel.send('⏳ Mise à jour de la base…');
    if (kind === 'neutral') {
      const count = await importNeutralVillages(villages);
      await message.channel.send(`✅ ${num(count)} villages neutres enregistrés (les anciens absents de la liste sont retirés).`);
      return;
    }
    const summary = await importMap(villages);
    const snapshot = await snapshotIfDue(villages);
    await message.channel.send(
      [
        `✅ Carte mise à jour : ${num(summary.villages)} villages, ${num(summary.playersUpdated)} joueurs mis à jour, ${num(summary.playersAdded)} ajoutés.`,
        ...(summary.clansAdded.length ? [`🆕 Clans créés : ${summary.clansAdded.join(', ')}`] : []),
        ...(snapshot ? [`📅 Relevé mensuel du ${monthLabel(snapshot.month)} enregistré (points et habitants de ${num(snapshot.players.length)} joueurs).`] : []),
      ].join('\n'),
    );
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Mise à jour impossible, réessaie plus tard.');
  } finally {
    busy.delete(message.author.id);
  }
}

/** `!supprimerJoueur <joueur ou village>` : après confirmation, supprime le joueur et son armée, et délie les membres reliés. */
async function removePlayer(message: SendableMessage, query: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  if (!query) return void (await message.reply('Ex. : `!supprimerJoueur Konan` (nom du joueur ou de son village).'));
  const player = findPlayer(query);
  if (!player) return void (await message.reply(`« ${query} » n'est pas dans la liste des joueurs.`));
  if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));

  busy.add(message.author.id);
  try {
    const army = gameData.armies.get(playerKey(player.name));
    const linked = (await linkedProfiles()).filter((m) => m.profile.player && playerKey(m.profile.player) === playerKey(player.name));
    const answer = await ask(
      message,
      [
        `Supprimer **${player.name}** (village ${player.village || '?'}, clan ${player.clan ?? 'sans clan'}) ?`,
        army ? `Sa dernière armée connue (${army.troops.genin} / ${army.troops.chuunin} / ${army.troops.jounin}) sera supprimée aussi.` : 'Aucune armée connue.',
        ...(linked.length ? [`Membres reliés à ce joueur, qui seront déliés : ${linked.map((m) => `<@${m.userId}>`).join(', ')}.`] : []),
        '-# Son village reste sur la carte : le prochain `!majJoueurs` le recrée s’il est encore dans le jeu.',
        '`oui` pour supprimer, `non` pour garder.',
      ].join('\n'),
    );
    if (answer === null) return;
    if (!/^(oui|o|yes|y)$/i.test(answer)) return void (await message.channel.send('Rien n’a été supprimé.'));
    await deletePlayer(player.name);
    for (const m of linked) await unlinkProfile(m.userId);
    await message.channel.send(`🗑️ ${player.name} supprimé${linked.length ? ` (${linked.length} membre${linked.length > 1 ? 's' : ''} délié${linked.length > 1 ? 's' : ''})` : ''}.`);
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Suppression impossible, réessaie plus tard.');
  } finally {
    busy.delete(message.author.id);
  }
}
