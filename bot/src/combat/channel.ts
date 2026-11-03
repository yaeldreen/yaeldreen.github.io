import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  findPlayer,
  gameData,
  linkedProfiles,
  MemberProfile,
  playerKey,
  removeAvailable as deleteAvailable,
  updateProfile,
} from '../game-data.js';
import { SendableMessage } from '../shared/conversation.js';
import { memberProfile } from '../shared/member.js';
import { combatData, hasLevels, mySide, prefillSide, profilesByPlayer, sideModal } from './sides.js';
import type { CombatData } from './combat.js';
import {
  applySubmit,
  prefillNote,
  CombatState,
  emptySide,
  formValues,
  optimalText,
  optimize,
  parseNumbers,
  resultText,
  sideText,
  simulate,
  SideForm,
} from './combat-form.js';

const COLOR = 0x991b1b;
/** Une simulation reste modifiable 3 h après la dernière action (gardée en mémoire du bot). */
const SESSION_TTL_MS = 3 * 3600_000;

type Side = 'attacker' | 'defender';
const SIDE_LABEL: Record<Side, string> = { attacker: 'Assaillant', defender: 'Défenseur' };

const HELP = [
  '**Simu combat** — estimation d’un combat (formules déduites de rapports) :',
  '`!combat` : simulation vide, à remplir avec les boutons ✏️',
  '`!combat <assaillant> vs <défenseur>` : préremplie avec ce qu’on sait des joueurs (nom ou village), ex. `!combat Tard vs Konan`',
  '`!combat vs <défenseur>` (ou `moi` à la place d’un nom) : ton camp est prérempli avec tes niveaux (`!mesNiveaux` dans #gestion-joueurs)',
  'Les boutons 🎟️ / 🏥 activent les tickets, 🔁 inverse les camps.',
  '',
  '`!opti <défenseur> [Genin Chuunin Jounin] [marge %]` : l’armée à envoyer contre ses troupes, celle dont tes pertes se reforment le plus vite',
  'Ex. `!opti Konan 1200 800 150` (ses troupes), `!opti Konan 1200 800 150 15` (marge 15 %, 10 % par défaut), `!opti Konan` (sa dernière armée connue).',
  '`!dispo <Genin Chuunin Jounin>` : ton armée disponible, prise en compte par `!opti` (`!dispo` pour la voir, `!dispo aucune` pour l’oublier).',
].join('\n');

const sessions = new Map<string, { state: CombatState; expires: number }>();

function render(data: CombatData, state: CombatState) {
  const title = (side: Side, icon: string) =>
    `${icon} ${SIDE_LABEL[side]}${state[side].player ? ` · ${state[side].player}` : ''}`;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('⚔️ Simulation de combat')
    .addFields(
      { name: title('attacker', '🗡️'), value: sideText(data, state.attacker, false) },
      { name: title('defender', '🛡️'), value: sideText(data, state.defender, true) },
      { name: '📊 Résultat', value: resultText(simulate(data, state)) },
    )
    .setFooter({ text: 'Genin / Chuunin / Jounin · estimation, formules déduites de rapports' });
  const plan = optimize(data, state);
  if (state.optimize)
    embed.addFields({ name: '🎯 Armée optimale', value: optimalText(plan, state) });

  const toggle = (id: string, label: string, on: boolean) =>
    new ButtonBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('combat:edit:attacker')
        .setLabel('✏️ Assaillant')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('combat:edit:defender')
        .setLabel('✏️ Défenseur')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('combat:swap')
        .setLabel('🔁 Inverser')
        .setStyle(ButtonStyle.Secondary),
    ),
    ...(plan
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('combat:useoptimal')
              .setLabel('📥 Envoyer l’armée optimale')
              .setStyle(ButtonStyle.Success),
          ),
        ]
      : []),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      toggle(
        'combat:toggle:attacker:combatTicket',
        '🎟️ Ticket attaque',
        state.attacker.combatTicket,
      ),
      toggle(
        'combat:toggle:defender:combatTicket',
        '🎟️ Ticket défense',
        state.defender.combatTicket,
      ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      toggle(
        'combat:toggle:attacker:hospitalTicket',
        '🏥 Ticket hôpital att.',
        state.attacker.hospitalTicket,
      ),
      toggle(
        'combat:toggle:defender:hospitalTicket',
        '🏥 Ticket hôpital déf.',
        state.defender.hospitalTicket,
      ),
    ),
  ];
  return { embeds: [embed], components: rows };
}

export async function handleSimuCombat(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  if (command.toLowerCase() === '!aide') {
    await message.reply(HELP);
    return;
  }
  if (command.toLowerCase() === '!opti') return optimizeCommand(message, rest);
  if (command.toLowerCase() === '!dispo') return availableCommand(message, rest);
  if (command.toLowerCase() !== '!combat') return;

  const data = combatData();
  if (!data) {
    await message.reply(
      'Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.',
    );
    return;
  }
  const state: CombatState = { attacker: emptySide(), defender: emptySide() };
  const notes: string[] = [];
  const query = rest.join(' ').trim();
  const [profile, members] = await Promise.all([memberProfile(message), profilesByPlayer()]);
  const mine = profile.player || hasLevels(profile) ? mySide(profile, members) : null;
  // « !combat » ou « !combat vs X » : l'assaillant est le membre (ses niveaux), s'il en a renseigné.
  if (mine && !/^(?!vs\b|contre\b)\S/i.test(query)) state.attacker = mine;
  if (query) {
    const [attackerName, defenderName = ''] = ` ${query}`
      .split(/\s+(?:vs|contre)\s+/i)
      .map((n) => n.trim());
    for (const [side, name] of [
      ['attacker', attackerName],
      ['defender', defenderName],
    ] as const) {
      if (!name.trim()) continue;
      if (/^moi$/i.test(name.trim())) {
        state[side] = mine ?? emptySide();
        if (!mine)
          notes.push('Je ne connais pas encore tes niveaux : `!mesNiveaux` dans #gestion-joueurs.');
        continue;
      }
      const prefilled = prefillSide(name, members);
      if (prefilled) state[side] = prefilled;
      else {
        state[side].player = name.trim();
        notes.push(
          `« ${name.trim()} » n'est pas dans la liste des joueurs : camp à remplir avec ✏️ ${SIDE_LABEL[side]}.`,
        );
      }
    }
  }
  const reply = await message.reply({
    ...render(data, state),
    ...(notes.length ? { content: notes.join('\n') } : {}),
  });
  sessions.set(reply.id, { state, expires: Date.now() + SESSION_TTL_MS });
}

function sessionOf(messageId: string): CombatState | null {
  const now = Date.now();
  for (const [id, s] of sessions) if (s.expires < now) sessions.delete(id);
  const session = sessions.get(messageId);
  if (!session) return null;
  session.expires = now + SESSION_TTL_MS;
  return session.state;
}

const EXPIRED = 'Cette simulation a expiré (ou le bot a redémarré) : relance `!combat`.';

/** Boutons et formulaires des fiches de combat (identifiants « combat:… »). */
export async function handleCombatInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  const data = combatData();
  const messageId = interaction.message?.id;
  const state = messageId ? sessionOf(messageId) : null;
  if (!data || !state) {
    await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral });
    return;
  }
  const [, action, side, field] = interaction.customId.split(':') as [
    string,
    string,
    Side | undefined,
    string | undefined,
  ];

  if (interaction.isButton()) {
    if (action === 'useoptimal') {
      const plan = optimize(data, state);
      if (plan) state.attacker = { ...state.attacker, troops: { ...plan.troops } };
      await interaction.update(render(data, state));
      return;
    }
    if (action === 'edit' && side) {
      await interaction.showModal(sideModal(`combat:modal:${side}`, SIDE_LABEL[side], state[side], side === 'defender'));
      return;
    }
    if (action === 'toggle' && side && (field === 'combatTicket' || field === 'hospitalTicket')) {
      state[side] = { ...state[side], [field]: !state[side][field] };
    } else if (action === 'swap') {
      [state.attacker, state.defender] = [state.defender, state.attacker];
    }
    await interaction.update(render(data, state));
    return;
  }

  if (interaction.isModalSubmit() && action === 'modal' && side && interaction.isFromMessage()) {
    const text = (id: string) =>
      interaction.fields.fields.has(id) ? interaction.fields.getTextInputValue(id) : undefined;
    const members = await profilesByPlayer();
    const result = applySubmit(
      state[side],
      {
        player: text('player') ?? '',
        troops: text('troops') ?? '',
        levels: text('levels') ?? '',
        hospital: text('hospital') ?? '',
        wall: text('wall'),
      },
      (name) => prefillSide(name, members),
    );
    if ('error' in result) {
      await interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
      return;
    }
    state[side] = result.side;
    await interaction.update(render(data, state));
    const note = prefillNote(result.side, result.prefilled, text('player') ?? '');
    if (note) await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral });
  }
}

/**
 * `!opti <défenseur> [Genin Chuunin Jounin] [marge %]` : fiche de combat avec le membre en assaillant (ses niveaux),
 * le défenseur avec les troupes données (sinon sa dernière armée connue), et l'armée optimale à lui envoyer,
 * prise dans l'armée disponible du membre si elle est connue (`!dispo`), sinon sans limite.
 */
async function optimizeCommand(message: SendableMessage, args: string[]): Promise<void> {
  const data = combatData();
  if (!data)
    return void (await message.reply(
      'Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.',
    ));

  // Les nombres de la fin : troupes du défenseur (3), puis éventuellement la marge.
  const numbers: number[] = [];
  while (args.length && /^\d+([.,]\d+)?%?$/.test(args[args.length - 1]) && numbers.length < 4) {
    numbers.unshift(Number(args.pop()!.replace(',', '.').replace('%', '')));
  }
  const defenderName = args.join(' ').trim();
  if (!defenderName || (numbers.length && numbers.length < 3)) {
    await message.reply(
      'Ex. : `!opti Konan 1200 800 150` (ses troupes : Genin Chuunin Jounin), puis une marge en % si tu veux : `!opti Konan 1200 800 150 15`.',
    );
    return;
  }
  const marginPct = numbers.length === 4 ? numbers[3] : 10;
  if (marginPct > 200)
    return void (await message.reply('La marge est un pourcentage entre 0 et 200.'));

  const [profile, members] = await Promise.all([memberProfile(message), profilesByPlayer()]);
  const notes: string[] = [];
  const state: CombatState = {
    attacker: mySide(profile, members),
    defender: emptySide(),
    optimize: { available: profile.available ?? null, marginPct },
  };
  if (!profile.player && !hasLevels(profile))
    notes.push(
      'Je ne connais pas tes niveaux : calcul sans bonus. `!mesNiveaux` dans #gestion-joueurs pour les renseigner.',
    );
  const defender = prefillSide(defenderName, members);
  if (defender) state.defender = defender;
  else {
    state.defender.player = defenderName;
    notes.push(
      `« ${defenderName} » n'est pas dans la liste des joueurs : ses niveaux sont inconnus (✏️ Défenseur pour les ajouter).`,
    );
  }
  if (numbers.length >= 3) {
    state.defender.troops = {
      genin: Math.floor(numbers[0]),
      chuunin: Math.floor(numbers[1]),
      jounin: Math.floor(numbers[2]),
    };
  } else if (Object.values(state.defender.troops).every((t) => t === null)) {
    notes.push(
      `Armée de ${state.defender.player} inconnue : donne-la après son nom, ex. \`!opti ${defenderName} 1200 800 150\`.`,
    );
  }

  // L'assaillant reçoit directement l'armée optimale : le 📊 Résultat montre le combat qu'elle donnerait.
  const plan = optimize(data, state);
  if (plan) state.attacker = { ...state.attacker, troops: { ...plan.troops } };
  const reply = await message.reply({
    ...render(data, state),
    ...(notes.length ? { content: notes.join('\n') } : {}),
  });
  sessions.set(reply.id, { state, expires: Date.now() + SESSION_TTL_MS });
}

/** `!dispo <Genin Chuunin Jounin>` : armée disponible du membre, utilisée par `!opti` ; `!dispo aucune` l'oublie. */
async function availableCommand(message: SendableMessage, args: string[]): Promise<void> {
  if (!args.length) {
    const { available } = await memberProfile(message);
    await message.reply(
      available
        ? `Ton armée disponible : **${available.genin} / ${available.chuunin} / ${available.jounin}** (Genin / Chuunin / Jounin).`
        : 'Aucune armée disponible enregistrée : `!opti` calcule sans limite. `!dispo 3000 2000 600` pour en donner une.',
    );
    return;
  }
  if (/^(aucune|aucun|non|reset)$/i.test(args.join(' '))) {
    await deleteAvailable(message.author.id);
    await message.reply('Armée disponible oubliée : `!opti` calcule maintenant sans limite.');
    return;
  }
  const troops = parseNumbers(args.join(' '), 3);
  if (!troops || troops.some((t) => t === null))
    return void (await message.reply(
      'Ex. : `!dispo 3000 2000 600` (Genin Chuunin Jounin), sans espace dans les nombres.',
    ));
  const [genin, chuunin, jounin] = troops as number[];
  await updateProfile(message.author.id, { available: { genin, chuunin, jounin } });
  await message.reply(
    `✅ Ton armée disponible : **${genin} / ${chuunin} / ${jounin}**. \`!opti\` ne proposera pas plus que ça.`,
  );
}
