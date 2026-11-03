import { EmbedBuilder } from 'discord.js';
import { gameData, getProfile } from '../game-data.js';
import { SendableMessage } from '../shared/conversation.js';
import { num } from '../shared/format.js';
import type { TroopCounts } from '../combat/combat.js';
import { planFullTeams, planPlunder, plunderCapacities, plunderOf, storageCapacity } from './plunder.js';

const COLOR = 0xa16207;
const DEPOT_MAX = 20;

const HELP = [
  '**Pillages** — ton armée répartie en équipes qui pillent sans dépasser tes dépôts (dépôts vides) :',
  '`!pillage <dépôt ressources> <dépôt nourriture> <Genin Chuunin Jounin>` : ex. `!pillage 8 8 1000 500 100`',
  '`!pillage <dépôt ressources> <dépôt nourriture>` : avec ton armée disponible (`!dispo` dans #simu-combat)',
  '`!pillageMax …` (mêmes nombres) : des équipes qui **remplissent** tes dépôts, autant que possible, et ce qu’il reste de l’armée',
].join('\n');

export async function handlePillages(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!pillage':
    case '!pillages':
      return plunder(message, rest, false);
    case '!pillagemax':
      return plunder(message, rest, true);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

const line = (t: TroopCounts): string => `${num(t.genin)} / ${num(t.chuunin)} / ${num(t.jounin)}`;

async function plunder(message: SendableMessage, args: string[], fill: boolean): Promise<void> {
  const values = args.map(Number);
  if (![2, 5].includes(args.length) || values.some((v) => !Number.isInteger(v) || v < 0)) return void (await message.reply(HELP));
  const [resourceDepot, foodDepot] = values;
  if ([resourceDepot, foodDepot].some((l) => l < 1 || l > DEPOT_MAX)) return void (await message.reply(`Les dépôts vont du niveau 1 à ${DEPOT_MAX}.`));
  if (!gameData.buildings || !gameData.troops) return void (await message.reply('Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.'));

  let army: TroopCounts | undefined;
  if (args.length === 5) army = { genin: values[2], chuunin: values[3], jounin: values[4] };
  else army = (await getProfile(message.author.id)).available;
  if (!army) return void (await message.reply('Donne ton armée : `!pillage 8 8 1000 500 100` (Genin Chuunin Jounin), ou enregistre-la avec `!dispo` dans #simu-combat.'));

  const caps = plunderCapacities(gameData.troops);
  const storage = storageCapacity(gameData.buildings, resourceDepot, foodDepot);
  const header = [
    `🏚️ Dépôts : ressources niv. ${resourceDepot} (${num(storage.resources)}) · nourriture niv. ${foodDepot} (${num(storage.food)})`,
    `🎯 Au plus **${num(storage.target)}** par ressource et par équipe`,
    `👥 Armée : ${line(army)} · pillage total ${num(plunderOf(army, caps))} par ressource`,
    '',
  ];
  const footer = { text: `Genin / Chuunin / Jounin · pillent ${caps.genin} / ${caps.chuunin} / ${caps.jounin} de chaque ressource` };

  if (fill) {
    const full = planFullTeams(army, storage.target, caps);
    if (!full.teams) return void (await message.reply('Aucune troupe à envoyer.'));
    const leftover = plunderOf(full.leftover, caps);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLOR)
          .setTitle(`💰 Pillage max : ${full.teams} équipe${full.teams > 1 ? 's' : ''} pleine${full.teams > 1 ? 's' : ''}`)
          .setDescription(
            [
              ...header,
              `**${full.teams} × équipe** de ${line(full.team)}`,
              `   💰 ${num(full.capacity)} par ressource (${Math.round((full.capacity / storage.target) * 100)} % des dépôts) · total ${num(full.capacity * full.teams)}`,
              '',
              leftover
                ? `🧺 Reste : **${line(full.leftover)}** (pillerait ${num(leftover)} par ressource)`
                : '🧺 Rien ne reste : toute l’armée est envoyée.',
            ].join('\n'),
          )
          .setFooter(footer),
      ],
    });
    return;
  }

  const plan = planPlunder(army, storage.target, caps);
  if (!plan.teams) return void (await message.reply('Aucune troupe à envoyer.'));

  const groups = plan.groups.map(
    (g) =>
      `**${g.count} × équipe** de ${line(g.team)}\n` +
      `   💰 ${num(g.capacity)} par ressource · reste ${num(storage.resources - g.capacity)} (ressources) / ${num(storage.food - g.capacity)} (nourriture)`,
  );
  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR)
        .setTitle(`💰 Pillages : ${plan.teams} équipe${plan.teams > 1 ? 's' : ''}`)
        .setDescription(
          [...header, ...groups].join('\n').slice(0, 4000),
        )
        .setFooter(footer),
    ],
  });
}
