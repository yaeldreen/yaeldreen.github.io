import { Attachment, EmbedBuilder, Message } from 'discord.js';
import { config } from '../config.js';
import { gameData, saveLevel } from '../game-data.js';
import { ask, buildingsOrWarn, hasEditorRole, isCancel, nextMessage, resolveBuilding, SendableMessage } from '../shared/conversation.js';
import {
  Building,
  fieldsFor,
  findBuilding,
  LevelField,
  levelFieldPages,
  levelSummary,
  LevelRow,
  parseAnswer,
  prerequisitesLine,
  suggestValue,
  withLevel,
} from './buildings.js';
import { readUpgradeScreenshot } from './ocr.js';

const COLOR = 0xb91c1c;


const HELP = [
  '**Build guide** — commandes :',
  '`!voir <bâtiment>` : niveaux, coûts et prérequis (ex. `!voir académie`, `!voir hopital`, `!voir ce`)',
  '`!voir <bâtiment> <niveau>` : un seul niveau (ex. `!voir académie 8`)',
  '`!voir` : liste des bâtiments',
  `\`!ajouterNiveau <bâtiment>\` + capture « Coûts pour passer au niveau … » : ajouter ou corriger un niveau (rôle « ${config.editorRole} »)`,
  `\`!supprimerNiveau <bâtiment> <niveau>\` : supprimer un niveau (rôle « ${config.editorRole} »)`,
].join('\n');

/** Membres en train de répondre aux questions du bot (une saisie à la fois par membre). */
const busy = new Set<string>();

export async function handleBuildGuide(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  const query = rest.join(' ');
  switch (command.toLowerCase()) {
    case '!voir':
      return show(message, query);
    case '!ajouterniveau':
      return addLevel(message, query);
    case '!supprimerniveau':
      return deleteLevel(message, query);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

async function show(message: SendableMessage, query: string): Promise<void> {
  if (!query) {
    const buildings = buildingsOrWarn(message);
    if (buildings) {
      const names = Object.values(buildings).map((b) => b.name).sort((a, b) => a.localeCompare(b, 'fr'));
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLOR)
            .setTitle('🏯 Bâtiments')
            .setDescription(names.map((n) => `• ${n}`).join('\n'))
            .setFooter({ text: 'Ex. : !voir académie  ·  !voir académie 8' }),
        ],
      });
    }
    return;
  }
  // « !voir académie 8 » : le dernier mot, s'il est un nombre, est le niveau voulu.
  const levelMatch = /^(.*\S)\s+(\d{1,3})$/.exec(query);
  const found = resolveBuilding(message, levelMatch ? levelMatch[1] : query);
  if (!found) return;
  const { building } = found;
  const wanted = levelMatch ? Number(levelMatch[2]) : null;
  const levels = wanted === null ? building.levels : building.levels.filter((l) => l.level === wanted);
  if (!levels.length) {
    const known = building.levels.map((l) => l.level);
    await message.reply(`${building.name} : niveau ${wanted} inconnu (niveaux ${Math.min(...known)} à ${Math.max(...known)}).`);
    return;
  }

  const prerequisites = prerequisitesLine(gameData.tree, building);
  const pages = levelFieldPages(levels);
  for (const [i, fields] of pages.entries()) {
    const embed = new EmbedBuilder().setColor(COLOR).addFields(fields);
    if (i === 0) {
      embed.setTitle(`🏯 ${building.name}${wanted !== null ? ` — niveau ${wanted}` : ''}`);
      if (prerequisites) embed.setDescription(`📋 ${prerequisites}`);
    }
    if (i === pages.length - 1) embed.setFooter({ text: '🪨 Pierre · 🪵 Bois · ⚙️ Fer · 🍖 Nourriture · 👥 Habitants' });
    if (i === 0) await message.reply({ embeds: [embed] });
    else await message.channel.send({ embeds: [embed] });
  }
}


/**
 * Demande la valeur d'un champ (3 essais). Avec une valeur proposée, `ok` la garde.
 * Retourne undefined si la saisie est abandonnée.
 */
async function askField(message: SendableMessage, field: LevelField, proposed?: string | number | null): Promise<string | number | undefined> {
  const hint = proposed !== undefined && proposed !== null ? `\nProposition : **${proposed}** — réponds \`ok\` pour la garder.` : '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await ask(message, field.question + hint);
    if (answer === null) return undefined;
    if (/^ok$/i.test(answer) && proposed !== undefined && proposed !== null) return proposed;
    const parsed = parseAnswer(field, answer);
    if ('value' in parsed) return parsed.value;
    await message.channel.send(attempt < 2 ? `${parsed.error} Réessaie.` : `${parsed.error} Trop d'essais, saisie abandonnée.`);
  }
  return undefined;
}

const imageOf = (m: Message): Attachment | undefined => m.attachments.find((a) => a.contentType?.startsWith('image/') ?? /\.(png|jpe?g|webp)$/i.test(a.name));

/** La capture jointe à la commande, ou demandée ensuite ; null pour une saisie à la main, undefined si abandon. */
async function screenshotOf(message: SendableMessage): Promise<Attachment | null | undefined> {
  const attached = imageOf(message);
  if (attached) return attached;
  await message.channel.send(
    `${message.author} Envoie la capture **« Coûts pour passer au niveau … »** du jeu.\n-# Ou \`manuel\` pour tout saisir à la main, \`annuler\` pour arrêter.`,
  );
  const reply = await nextMessage(message);
  if (!reply) return undefined;
  const image = imageOf(reply);
  if (image) return image;
  if (/^manuel$/i.test(reply.content.trim())) return null;
  await message.channel.send(isCancel(reply.content) ? 'Saisie annulée.' : 'Pas de capture reçue, saisie abandonnée.');
  return undefined;
}

async function addLevel(message: SendableMessage, query: string): Promise<void> {
  if (!hasEditorRole(message)) {
    await message.reply(`Seuls les membres avec le rôle « ${config.editorRole} » peuvent modifier les données.`);
    return;
  }
  if (!query) {
    await message.reply('Précise le bâtiment et joins la capture : `!ajouterNiveau académie`.');
    return;
  }
  if (busy.has(message.author.id)) {
    await message.reply('Tu as déjà une saisie en cours : termine-la ou réponds `annuler`.');
    return;
  }
  const found = resolveBuilding(message, query);
  if (!found) return;
  const { key, building } = found;

  busy.add(message.author.id);
  try {
    const row = await collectLevel(message, building);
    if (!row) return;
    const replaces = building.levels.some((l) => l.level === row.level);

    // Récapitulatif : « oui » enregistre, « modifier » repasse chaque valeur, « non » abandonne.
    for (;;) {
      const answer = await ask(
        message,
        `Récapitulatif — **${building.name}**${replaces ? ' (⚠️ remplace le niveau existant)' : ''} :\n${levelSummary(row)}\n\n\`oui\` pour enregistrer, \`modifier\` pour corriger une valeur, \`non\` pour abandonner.`,
      );
      if (answer === null) return;
      if (/^(oui|o|yes|y)$/i.test(answer)) break;
      if (/^modifier$/i.test(answer)) {
        for (const field of fieldsFor(building)) {
          const value = await askField(message, { ...field, question: `${field.column} : **${row[field.key] ?? '—'}** — \`ok\` pour garder, ou la bonne valeur.` }, row[field.key]);
          if (value === undefined) return;
          row[field.key] = value;
        }
        continue;
      }
      await message.channel.send('Rien n’a été enregistré.');
      return;
    }

    await saveLevel(key, (levels) => withLevel(levels, row), message.author.tag);
    await message.channel.send(`✅ ${building.name} niveau ${row.level} enregistré. Visible tout de suite avec \`!voir ${building.name} ${row.level}\`.`);
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Enregistrement impossible, réessaie plus tard.');
  } finally {
    busy.delete(message.author.id);
  }
}

/** Valeurs du nouveau niveau : lues sur la capture, puis questions pour ce qui manque. Null si abandon. */
async function collectLevel(message: SendableMessage, building: Building): Promise<LevelRow | null> {
  const row: Record<string, string | number> = {};
  const screenshot = await screenshotOf(message);
  if (screenshot === undefined) return null;

  if (screenshot) {
    await message.channel.send('🔎 Lecture de la capture…');
    try {
      const image = Buffer.from(await (await fetch(screenshot.url)).arrayBuffer());
      const { level, costs } = await readUpgradeScreenshot(image);
      if (level !== null) row['level'] = level;
      if (costs) Object.assign(row, costs);
      else await message.channel.send('Je n’arrive pas à lire les coûts sur cette capture : je vais te les demander.');
    } catch (error) {
      console.error(error);
      await message.channel.send('Lecture de la capture impossible : je vais te demander les valeurs.');
    }
  }

  for (const field of fieldsFor(building)) {
    if (row[field.key] !== undefined) continue;
    const proposed = field.key !== 'level' && typeof row['level'] === 'number' ? suggestValue(building.levels, field.key, row['level']) : null;
    const value = await askField(message, field, proposed);
    if (value === undefined) return null;
    row[field.key] = value;
  }
  return row as LevelRow;
}

async function deleteLevel(message: SendableMessage, query: string): Promise<void> {
  if (!hasEditorRole(message)) {
    await message.reply(`Seuls les membres avec le rôle « ${config.editorRole} » peuvent modifier les données.`);
    return;
  }
  const match = /^(.*\S)\s+(\d{1,3})$/.exec(query);
  if (!match) {
    await message.reply('Précise le bâtiment et le niveau : `!supprimerNiveau académie 13`.');
    return;
  }
  if (busy.has(message.author.id)) {
    await message.reply('Tu as déjà une saisie en cours : termine-la ou réponds `annuler`.');
    return;
  }
  const found = resolveBuilding(message, match[1]);
  if (!found) return;
  const { key, building } = found;
  const level = Number(match[2]);
  const row = building.levels.find((l) => l.level === level);
  if (!row) {
    await message.reply(`${building.name} n'a pas de niveau ${level}.`);
    return;
  }

  busy.add(message.author.id);
  try {
    const answer = await ask(message, `Supprimer **${building.name}** :\n${levelSummary(row)}\n\n\`oui\` pour supprimer, \`non\` pour garder.`);
    if (answer === null) return;
    if (!/^(oui|o|yes|y)$/i.test(answer)) {
      await message.channel.send('Rien n’a été supprimé.');
      return;
    }
    await saveLevel(key, (levels) => levels.filter((l) => l.level !== level), message.author.tag);
    await message.channel.send(`🗑️ ${building.name} niveau ${level} supprimé.`);
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Suppression impossible, réessaie plus tard.');
  } finally {
    busy.delete(message.author.id);
  }
}

export { HELP as BUILD_GUIDE_HELP };
