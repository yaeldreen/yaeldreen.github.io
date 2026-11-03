import { EmbedBuilder } from 'discord.js';
import { gameData } from '../game-data.js';
import { ask, resolveBuilding, SendableMessage } from '../shared/conversation.js';
import { chunkFields, EmbedField, formatDuration, num } from '../shared/format.js';
import { PlanStep, simulateUpgrades } from './simulation.js';

const COLOR = 0xb45309;
const DEPOT_MAX = 20;

const HELP = [
  '**Simu construction** — ce qu’il faut construire pour monter un bâtiment, dépôts compris :',
  '`!simu <bâtiment> <niveau actuel> <niveau visé>` : le bot demande ensuite tes niveaux de dépôts',
  '`!simu <bâtiment> <actuel> <visé> <dépôt ressources> <dépôt nourriture>` : tout d’un coup',
  'Ex. `!simu qg 10 15 8 8`, `!simu académie 5 10`',
].join('\n');

/** Membres qui répondent déjà à une question du bot dans ce salon. */
const busy = new Set<string>();

export async function handleSimuConstru(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!simu':
      return simulate(message, rest.join(' '));
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

/** Demande un niveau de dépôt (1 à 20) ; null si abandon. */
async function askDepot(message: SendableMessage, label: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await ask(message, `Niveau de ton **${label}** ? (1 à ${DEPOT_MAX})`);
    if (answer === null) return null;
    const level = Number(answer);
    if (Number.isInteger(level) && level >= 1 && level <= DEPOT_MAX) return level;
    await message.channel.send(attempt < 2 ? `Il faut un niveau entre 1 et ${DEPOT_MAX}. Réessaie.` : 'Trop d’essais, simulation abandonnée.');
  }
  return null;
}

async function simulate(message: SendableMessage, query: string): Promise<void> {
  // Les 2 à 4 nombres de la fin sont les niveaux ; ce qui précède est le bâtiment (qui peut contenir des espaces).
  const match = /^(.*?\D)\s+(\d{1,2})\s+(\d{1,2})(?:\s+(\d{1,2}))?(?:\s+(\d{1,2}))?$/.exec(query);
  if (!match) {
    await message.reply(HELP);
    return;
  }
  const found = resolveBuilding(message, match[1]);
  if (!found) return;
  const { key, building } = found;
  const current = Number(match[2]);
  const target = Number(match[3]);
  const maxLevel = Math.max(...building.levels.map((l) => l.level));
  if (target <= current) {
    await message.reply('Le niveau visé doit être plus haut que le niveau actuel.');
    return;
  }
  if (current > maxLevel) {
    await message.reply(`${building.name} va jusqu'au niveau ${maxLevel}.`);
    return;
  }

  // Un dépôt choisi comme bâtiment à monter prend son niveau dans « niveau actuel ».
  let resourceDepot = match[4] ? Number(match[4]) : key === 'resourceDepot' ? current : null;
  let foodDepot = match[5] ? Number(match[5]) : key === 'foodDepot' ? current : null;
  if ((resourceDepot === null || foodDepot === null) && busy.has(message.author.id)) {
    await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.');
    return;
  }
  busy.add(message.author.id);
  try {
    resourceDepot ??= await askDepot(message, 'Dépôt de ressources');
    if (resourceDepot === null) return;
    foodDepot ??= await askDepot(message, 'Dépôt de nourriture');
    if (foodDepot === null) return;
  } finally {
    busy.delete(message.author.id);
  }
  if ([resourceDepot, foodDepot].some((l) => l < 1 || l > DEPOT_MAX)) {
    await message.reply(`Les dépôts vont du niveau 1 à ${DEPOT_MAX}.`);
    return;
  }

  const plan = simulateUpgrades(gameData.buildings!, { buildingId: key, currentLevel: current, targetLevel: target, resourceDepotLevel: resourceDepot, foodDepotLevel: foodDepot });
  const depotSteps = plan.steps.filter((s) => s.isStorage).length;
  const summary = [
    `🏚️ Dépôts au départ : ressources niv. ${resourceDepot} · nourriture niv. ${foodDepot}`,
    '',
    `⏱️ **Temps total : ${formatDuration(plan.totalSeconds)}**`,
    depotSteps ? `📦 dont dépôts : ${formatDuration(plan.storageSeconds)} (${depotSteps} amélioration${depotSteps > 1 ? 's' : ''})` : '📦 Aucun dépôt à monter',
    '',
    '**Coût total**',
    `🪨 ${num(plan.totals.stone)}  🪵 ${num(plan.totals.wood)}  ⚙️ ${num(plan.totals.iron)}  🍖 ${num(plan.totals.food)}`,
    ...(plan.blocker ? ['', `⚠️ ${plan.blocker}`] : []),
  ].join('\n');

  const pages = chunkFields(plan.steps.map(stepField));
  const first = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`🏗️ ${building.name} : niveau ${current} → ${target}`)
    .setDescription(summary);
  if (pages.length) first.addFields(pages[0]);
  if (pages.length <= 1) first.setFooter({ text: '🏯 Bâtiment visé · 📦 Dépôt imposé par la capacité' });
  await message.reply({ embeds: [first] });
  for (const [i, fields] of pages.slice(1).entries()) {
    const embed = new EmbedBuilder().setColor(COLOR).addFields(fields);
    if (i === pages.length - 2) embed.setFooter({ text: '🏯 Bâtiment visé · 📦 Dépôt imposé par la capacité' });
    await message.channel.send({ embeds: [embed] });
  }
}

/** Une étape : « 3. 📦 Dépôt de ressources → niv. 9 · ⏱️ 2 h », ses coûts, et pourquoi pour un dépôt. */
function stepField(step: PlanStep, index: number): EmbedField {
  const r = step.row;
  const costs = `🪨 ${num(Number(r['stone']))}  🪵 ${num(Number(r['wood']))}  ⚙️ ${num(Number(r['iron']))}  🍖 ${num(Number(r['food']))}`;
  return {
    name: `${index + 1}. ${step.isStorage ? '📦' : '🏯'} ${step.label} → niv. ${step.level}  ·  ⏱️ ${formatDuration(step.seconds)}`,
    value: step.isStorage ? `${costs}\n_${step.explanation}_` : costs,
  };
}
