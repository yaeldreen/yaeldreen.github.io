import { EmbedBuilder } from 'discord.js';
import { gameData, getProfile, updateProfile } from '../game-data.js';
import { SendableMessage } from '../shared/conversation.js';
import { formatDuration, num } from '../shared/format.js';
import { parisClock, parisDay, parseParisTime } from '../shared/paris-time.js';
import { parseFieldLevels, RESOURCES, timeSinceEmpty } from './production.js';

const COLOR = 0x15803d;
/** Heure à la fin de `!secondes` : « 21:39:10 », « 21h39 », « 01/11 21:39:10 ». */
const TRAILING_TIME = /\s+((?:\d{1,2}\/\d{1,2}(?:\/\d{4})?\s+)?\d{1,2}\s*[:h]\s*\d{2}(?:\s*[:m]\s*\d{2}s?)?)$/i;

const HELP = [
  '**Calcul seconde** — depuis quand une ressource produit, d’après ton stock relevé à une heure précise :',
  '`!mesChamps <9 niveaux>` : tes champs, dans l’ordre 2 pierre, 2 bois, 2 fer, 3 nourriture, ex. `!mesChamps 5 5 4 4 6 6 3 3 3` (retenus)',
  '`!secondes <pierre> <bois> <fer> <nourriture> [heure]` : ton stock, ex. `!secondes 1234 980 1500 2100 21:39:10` (`?` si inconnu, sans heure = maintenant)',
].join('\n');

export async function handleCalculSeconde(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!meschamps':
      return setFields(message, rest);
    case '!secondes':
    case '!seconde':
      return seconds(message, rest.join(' '));
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

async function setFields(message: SendableMessage, args: string[]): Promise<void> {
  const counts = gameData.fieldCounts;
  if (!counts) return void (await message.reply('Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.'));
  if (!args.length) {
    const { fields } = await getProfile(message.author.id);
    await message.reply(
      fields
        ? `Tes champs : ${RESOURCES.map((r) => `${r.emoji} ${fields[r.key].join(' / ')}`).join(' · ')}`
        : 'Aucun champ enregistré : `!mesChamps 5 5 4 4 6 6 3 3 3` (2 pierre, 2 bois, 2 fer, 3 nourriture).',
    );
    return;
  }
  const parsed = parseFieldLevels(args, counts);
  if ('error' in parsed) return void (await message.reply(`${parsed.error} Ex. : \`!mesChamps 5 5 4 4 6 6 3 3 3\`.`));
  await updateProfile(message.author.id, { fields: parsed });
  await message.reply(`✅ Tes champs : ${RESOURCES.map((r) => `${r.emoji} ${parsed[r.key].join(' / ')}`).join(' · ')}`);
}

async function seconds(message: SendableMessage, query: string): Promise<void> {
  const buildings = gameData.buildings;
  if (!buildings) return void (await message.reply('Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.'));
  const { fields } = await getProfile(message.author.id);
  if (!fields) return void (await message.reply('Donne d’abord tes champs : `!mesChamps 5 5 4 4 6 6 3 3 3` (2 pierre, 2 bois, 2 fer, 3 nourriture).'));

  const timeMatch = TRAILING_TIME.exec(` ${query}`);
  const atMs = timeMatch ? parseParisTime(timeMatch[1], Date.now()) : Date.now();
  if (atMs === null) return void (await message.reply(`Heure illisible : « ${timeMatch![1]} ».`));
  const amounts = (timeMatch ? ` ${query}`.slice(0, timeMatch.index) : query).trim().split(/\s+/).filter(Boolean);
  if (amounts.length !== 4 || amounts.some((a) => a !== '?' && !/^\d+$/.test(a))) return void (await message.reply(HELP));

  const lines = RESOURCES.map((r, i) => {
    const amount = amounts[i] === '?' ? null : Number(amounts[i]);
    const t = timeSinceEmpty(buildings, fields[r.key], amount, atMs);
    if (amount === null) return `${r.emoji} **${r.label}** · ${num(t.perHour)} /h · stock inconnu`;
    if (t.elapsedSeconds === null || t.zeroAt === null) return `${r.emoji} **${r.label}** · ${num(amount)} · aucune production`;
    return `${r.emoji} **${r.label}** · ${num(amount)} à ${num(t.perHour)} /h\n   depuis **${formatDuration(t.elapsedSeconds)}** · à 0 à **${parisClock(t.zeroAt)}** (${parisDay(t.zeroAt)})`;
  });
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`⏱️ Stock relevé à ${parisClock(atMs)} (${parisDay(atMs)})`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Heures de Paris · tes champs : ${RESOURCES.map((r) => fields[r.key].join('/')).join(' · ')}` }),
    ],
  });
}
