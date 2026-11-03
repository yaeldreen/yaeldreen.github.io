import { Attachment, EmbedBuilder, Message } from 'discord.js';
import { config } from '../config.js';
import { findPlayer, findVillage, gameData, KnownPlayer, playerKey } from '../game-data.js';
import { compareSnapshots } from '../gestion-joueurs/monthly-snapshot.js';
import { OWN_CLAN } from '../gestion-joueurs/store.js';
import { readReportImage } from '../retours/report-ocr.js';
import { ParsedReport, parseReportText } from '../retours/report-parser.js';
import { chunkFields } from '../shared/format.js';
import { ask, hasEditorRole, isCancel, nextMessage, SendableMessage } from '../shared/conversation.js';
import { parseAllLevels } from '../shared/member-levels.js';
import { pickVillage } from '../shared/pick-village.js';
import { parseNumbers } from '../combat/combat-form.js';
import { clanLines, playerCard, sectionLine, splitComment, survivors, toPlayerLevels, troopsLine } from './format.js';
import { addClan, addPlayer, removeClan, saveArmy, savePlayerComment, savePlayerLevels, setPlayerClan } from './store.js';

const COLOR = 0x1d4ed8;
const NO_CLAN = 'Sans clan';

const HELP = [
  '**Infos ennemis** — armées et niveaux des autres joueurs (utilisés par #simu-combat et #retours) :',
  '`!rapport` + capture du rapport de combat (ou le texte copié après la commande) : enregistre les troupes restantes des ennemis',
  '`!joueur <joueur ou village>` : sa fiche (points, niveaux, dernière armée, évolution du mois, commentaire) ; `!joueur` seul pour le chercher dans une liste',
  '`!clan <nom>` : les joueurs d’un clan · `!clans` : la liste des clans',
  '`!niveaux <joueur> <CE> <académie> <chunin> <jounin> <mur> <hôpital>` : ses niveaux, `?` = inchangé, ex. `!niveaux Konan 12 8 8 ? 7 ?`',
  '`!armee <joueur> <Genin Chuunin Jounin>` : son armée vue autrement que par un rapport',
  '`!commentaire <joueur> : <texte>` : une note libre, visible dans `!joueur` (`!commentaire <joueur> :` pour l’effacer)',
  '',
  `**Gestion des clans** (rôle « ${config.editorRole} ») :`,
  '`!ajouterClan <nom>` · `!supprimerClan <nom>` (ses joueurs passent sans clan)',
  '`!deplacer <joueur> > <clan>` (ou `> sans clan`) · `!ajouterJoueur <joueur> > <clan>`',
].join('\n');

const busy = new Set<string>();

export async function handleInfosEnnemis(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  const query = rest.join(' ').trim();
  switch (command.toLowerCase()) {
    case '!rapport':
      return report(message);
    case '!joueur':
      return showPlayer(message, query);
    case '!clan':
      return showClan(message, query);
    case '!clans':
      return listClans(message);
    case '!niveaux':
      return setLevels(message, rest);
    case '!armee':
    case '!armée':
      return setArmy(message, rest);
    case '!commentaire':
    case '!comment':
      return setComment(message, query);
    case '!ajouterclan':
      return createClan(message, query);
    case '!supprimerclan':
      return deleteClan(message, query);
    case '!deplacer':
    case '!déplacer':
      return movePlayer(message, query);
    case '!ajouterjoueur':
      return createPlayer(message, query);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const isOwnClan = (p: KnownPlayer | null): boolean => p?.clan === OWN_CLAN;

/** Clan existant désigné sans tenir compte des accents ni des majuscules ; null pour « sans clan », undefined si inconnu. */
function findClan(name: string): string | null | undefined {
  if (/^sans[\s-]*clans?$/i.test(norm(name))) return null;
  return gameData.clans.find((c) => norm(c) === norm(name));
}

/** Évolution du mois d'un joueur, si les deux relevés mensuels existent. */
function evolutionOf(name: string) {
  const { current, previous } = gameData.snapshots;
  if (!current || !previous) return undefined;
  return compareSnapshots(previous, current).find((r) => playerKey(r.name) === playerKey(name));
}

// --- Rapport de combat ---

const imageOf = (m: Message): Attachment | undefined =>
  m.attachments.find((a) => a.contentType?.startsWith('image/') ?? /\.(png|jpe?g|webp)$/i.test(a.name));
const textFileOf = (m: Message): Attachment | undefined => m.attachments.find((a) => /\.txt$/i.test(a.name) || (a.contentType?.startsWith('text/') ?? false));

/** Sections du rapport : capture (lue), texte collé après la commande ou fichier texte ; sinon demandé. Null si abandon. */
async function reportSections(message: SendableMessage): Promise<ParsedReport[] | null> {
  const fromMessage = async (m: Message): Promise<ParsedReport[] | null> => {
    const image = imageOf(m);
    if (image) {
      await message.channel.send('🔎 Lecture du rapport…');
      return (await readReportImage(Buffer.from(await (await fetch(image.url)).arrayBuffer()))).sections;
    }
    const file = textFileOf(m);
    const text = file ? await (await fetch(file.url)).text() : m.content.replace(/^\s*!\S+/, '');
    return text.trim() ? parseReportText(text).sections : null;
  };
  const direct = await fromMessage(message);
  if (direct) return direct;
  await message.channel.send(`${message.author} Envoie la capture du **rapport de combat** (ou colle son texte).\n-# Ou \`annuler\`.`);
  const reply = await nextMessage(message);
  if (!reply) return null;
  if (isCancel(reply.content)) {
    await message.channel.send('Annulé.');
    return null;
  }
  return (await fromMessage(reply)) ?? [];
}

async function report(message: SendableMessage): Promise<void> {
  if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
  busy.add(message.author.id);
  try {
    const sections = await reportSections(message);
    if (sections === null) return;
    if (!sections.length) return void (await message.channel.send('Rapport non reconnu. Tu peux enregistrer une armée à la main : `!armee <joueur> <Genin Chuunin Jounin>`.'));

    const toSave: { player: string; troops: NonNullable<ReturnType<typeof survivors>>; side: ParsedReport['side'] }[] = [];
    const lines: string[] = [];
    for (const s of sections) {
      const known = findPlayer(s.village);
      const name = known?.name ?? s.village;
      if (isOwnClan(known)) {
        lines.push(`**${s.side ?? 'Section'} · ${name}** — ${OWN_CLAN}, ignoré.`);
        continue;
      }
      const remaining = survivors(s.ninjas, s.killed);
      lines.push(sectionLine(s.side, known ? name : `${name} (joueur inconnu)`, s.ninjas, s.killed, remaining));
      if (remaining && name) toSave.push({ player: name, troops: remaining, side: s.side });
    }
    if (!toSave.length) return void (await message.channel.send(`${lines.join('\n\n')}\n\nRien à enregistrer.`));

    const answer = await ask(message, `${lines.join('\n\n')}\n\nJ'enregistre ${toSave.length > 1 ? 'ces armées' : 'cette armée'} ? (\`oui\` / \`non\`)`);
    if (answer === null) return;
    if (!/^(oui|o|yes|y)$/i.test(answer)) return void (await message.channel.send('Rien n’a été enregistré.'));
    for (const s of toSave) await saveArmy(s.player, s.troops, s.side);
    await message.channel.send(`✅ Enregistré : ${toSave.map((s) => `**${s.player}** ${troopsLine(s.troops)}`).join(', ')}.`);
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Lecture ou enregistrement impossible. Tu peux passer par `!armee <joueur> <Genin Chuunin Jounin>`.');
  } finally {
    busy.delete(message.author.id);
  }
}

// --- Consultation ---

async function showPlayer(message: SendableMessage, query: string): Promise<void> {
  // « !joueur » seul : on fait chercher et choisir le joueur dans une liste.
  if (!query) {
    if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
    busy.add(message.author.id);
    try {
      const picked = await pickVillage(message, 'du joueur', {
        question: 'Quel joueur ? Tape le début de son nom ou de son village.',
        playersOnly: true,
      });
      if (!picked) return;
      query = findPlayer(picked.kage) ? picked.kage : picked.name;
    } finally {
      busy.delete(message.author.id);
    }
  }
  const player = findPlayer(query);
  if (!player) return void (await message.reply(`« ${query} » n'est pas dans la liste des joueurs.`));
  const village = findVillage(player.village) ?? findVillage(player.name);
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🥷 ${player.name}`)
        .setDescription(playerCard(player, village, gameData.armies.get(playerKey(player.name)), evolutionOf(player.name)))
        .setFooter({ text: 'Armée : Genin / Chuunin / Jounin restants au dernier rapport' }),
    ],
  });
}

async function showClan(message: SendableMessage, query: string): Promise<void> {
  if (!query) return listClans(message);
  const clan = findClan(query);
  if (clan === undefined) return void (await message.reply(`Clan inconnu : « ${query} ». \`!clans\` pour la liste.`));
  const players = gameData.players.filter((p) => p.clan === clan);
  if (!players.length) return void (await message.reply(`Aucun joueur dans ${clan ?? NO_CLAN}.`));
  const lines = clanLines(players, gameData.armies, playerKey);
  // Une fiche par paquet de lignes (limite de taille d'un message Discord).
  const pages = chunkFields(lines.map((l) => ({ name: '​', value: l })), 40, 3800).map((page) => page.map((f) => f.value).join('\n'));
  for (const [i, page] of pages.entries()) {
    const embed = new EmbedBuilder().setColor(COLOR).setDescription(page);
    if (i === 0) embed.setTitle(`🏴 ${clan ?? NO_CLAN} — ${players.length} joueur${players.length > 1 ? 's' : ''}`);
    if (i === 0) await message.reply({ embeds: [embed] });
    else await message.channel.send({ embeds: [embed] });
  }
}

async function listClans(message: SendableMessage): Promise<void> {
  const counts = new Map<string, number>();
  for (const p of gameData.players) counts.set(p.clan ?? NO_CLAN, (counts.get(p.clan ?? NO_CLAN) ?? 0) + 1);
  const names = [...new Set([...gameData.clans, ...counts.keys()])].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'fr'));
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`🏴 Clans (${names.length})`)
        .setDescription(names.map((n) => `• **${n}** · ${counts.get(n) ?? 0} joueur${(counts.get(n) ?? 0) > 1 ? 's' : ''}`).join('\n').slice(0, 4000))
        .setFooter({ text: '!clan <nom> pour voir ses joueurs' }),
    ],
  });
}

// --- Saisie à la main ---

/** Joueur désigné par les mots qui précèdent les `count` derniers ; null (avec message) si inconnu ou de notre clan. */
async function targetPlayer(message: SendableMessage, words: string[], usage: string): Promise<string | null> {
  const name = words.join(' ').trim();
  if (!name) {
    await message.reply(usage);
    return null;
  }
  const player = findPlayer(name);
  if (isOwnClan(player)) {
    await message.reply(`${player!.name} est de ${OWN_CLAN} : ses niveaux se règlent avec \`!mesNiveaux\` dans #gestion-joueurs.`);
    return null;
  }
  return player?.name ?? name;
}

async function setLevels(message: SendableMessage, args: string[]): Promise<void> {
  const usage = 'Ex. : `!niveaux Konan 12 8 8 ? 7 ?` (CE, Académie, Chunin, Jounin, Mur, Hôpital ; `?` = inchangé).';
  if (args.length < 7) return void (await message.reply(usage));
  const parsed = parseAllLevels(args.slice(-6));
  if ('error' in parsed) return void (await message.reply(parsed.error.replace('!mesNiveaux 11 8 8 5 7 3', `!niveaux ${args.slice(0, -6).join(' ')} 12 8 8 ? 7 ?`)));
  const player = await targetPlayer(message, args.slice(0, -6), usage);
  if (!player) return;
  const levels = toPlayerLevels(parsed.levels);
  if (!Object.keys(levels).length) return void (await message.reply('Aucun niveau donné (que des `?`) : rien à changer.'));
  await savePlayerLevels(player, levels);
  const known = findPlayer(player);
  await message.reply(`✅ Niveaux de **${player}** enregistrés${known ? '' : ' (nouveau joueur, rangé sans clan)'}.`);
}

async function setArmy(message: SendableMessage, args: string[]): Promise<void> {
  const usage = 'Ex. : `!armee Konan 1200 800 150` (Genin Chuunin Jounin).';
  if (args.length < 4) return void (await message.reply(usage));
  const troops = parseNumbers(args.slice(-3).join(' '), 3);
  if (!troops || troops.some((t) => t === null)) return void (await message.reply(usage));
  const player = await targetPlayer(message, args.slice(0, -3), usage);
  if (!player) return;
  const [genin, chuunin, jounin] = troops as number[];
  await saveArmy(player, { genin, chuunin, jounin }, null);
  await message.reply(`✅ Armée de **${player}** : ${troopsLine({ genin, chuunin, jounin })}.`);
}

// --- Gestion des clans (éditeurs) ---

async function requireEditor(message: SendableMessage): Promise<boolean> {
  if (hasEditorRole(message)) return true;
  await message.reply(`Seuls les membres avec le rôle « ${config.editorRole} » peuvent gérer les clans.`);
  return false;
}

async function createClan(message: SendableMessage, name: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  if (!name) return void (await message.reply('Ex. : `!ajouterClan Kuro No Kishidan`.'));
  if (findClan(name) !== undefined) return void (await message.reply(`Le clan « ${name} » existe déjà.`));
  await addClan(name);
  await message.reply(`✅ Clan **${name}** créé.`);
}

async function deleteClan(message: SendableMessage, name: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  const clan = name ? findClan(name) : undefined;
  if (!clan) return void (await message.reply(`Clan inconnu : « ${name} ». \`!clans\` pour la liste.`));
  if (clan === OWN_CLAN) return void (await message.reply(`On ne supprime pas ${OWN_CLAN}.`));
  if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
  busy.add(message.author.id);
  try {
    const members = gameData.players.filter((p) => p.clan === clan).length;
    const answer = await ask(message, `Supprimer le clan **${clan}** ? Ses ${members} joueur${members > 1 ? 's passeront' : ' passera'} sans clan. (\`oui\` / \`non\`)`);
    if (answer === null) return;
    if (!/^(oui|o|yes|y)$/i.test(answer)) return void (await message.channel.send('Rien n’a été supprimé.'));
    const moved = await removeClan(clan);
    await message.channel.send(`🗑️ Clan ${clan} supprimé (${moved} joueur${moved > 1 ? 's' : ''} sans clan).`);
  } finally {
    busy.delete(message.author.id);
  }
}

/** « <joueur> > <clan> » */
const splitArrow = (query: string): [string, string] | null => {
  const parts = query.split(/\s*(?:>|->|→)\s*/);
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
};

async function movePlayer(message: SendableMessage, query: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  const parts = splitArrow(query);
  if (!parts) return void (await message.reply('Ex. : `!deplacer Konan > Maelström` ou `!deplacer Konan > sans clan`.'));
  const player = findPlayer(parts[0]);
  if (!player) return void (await message.reply(`« ${parts[0]} » n'est pas dans la liste des joueurs.`));
  const clan = findClan(parts[1]);
  if (clan === undefined) return void (await message.reply(`Clan inconnu : « ${parts[1]} ». Crée-le d'abord avec \`!ajouterClan\`.`));
  await setPlayerClan(player.name, clan);
  await message.reply(`✅ **${player.name}** : ${player.clan ?? NO_CLAN} → **${clan ?? NO_CLAN}**.`);
}

async function createPlayer(message: SendableMessage, query: string): Promise<void> {
  if (!(await requireEditor(message))) return;
  const parts = splitArrow(query) ?? (query ? [query, NO_CLAN] : null);
  if (!parts) return void (await message.reply('Ex. : `!ajouterJoueur Konan > Kuro No Kishidan`.'));
  if (findPlayer(parts[0])) return void (await message.reply(`« ${parts[0]} » est déjà dans la liste des joueurs.`));
  const clan = findClan(parts[1]);
  if (clan === undefined) return void (await message.reply(`Clan inconnu : « ${parts[1]} ». Crée-le d'abord avec \`!ajouterClan\`.`));
  const village = findVillage(parts[0]);
  await addPlayer(village?.kage ?? parts[0], village?.name ?? '', clan);
  await message.reply(`✅ **${village?.kage ?? parts[0]}** ajouté dans ${clan ?? NO_CLAN}${village ? ` (village ${village.name})` : ''}.`);
}

const COMMENT_MAX = 500;

async function setComment(message: SendableMessage, query: string): Promise<void> {
  const parts = splitComment(query);
  if (!parts) return void (await message.reply('Ex. : `!commentaire Konan : attaque surtout la nuit` (`!commentaire Konan :` pour effacer).'));
  if (parts.text.length > COMMENT_MAX) return void (await message.reply(`Commentaire trop long (${parts.text.length} caractères, ${COMMENT_MAX} au plus).`));
  const known = findPlayer(parts.player);
  if (!known && !parts.text) return void (await message.reply(`« ${parts.player} » n'est pas dans la liste des joueurs.`));
  const player = known?.name ?? parts.player;
  await savePlayerComment(player, parts.text, message.member?.displayName ?? message.author.username);
  await message.reply(
    parts.text
      ? `💬 Commentaire enregistré pour **${player}**${known ? '' : ' (nouveau joueur, rangé sans clan)'}. Visible avec \`!joueur ${player}\`.`
      : `Commentaire de **${player}** effacé.`,
  );
}
