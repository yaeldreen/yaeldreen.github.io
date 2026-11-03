import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getProfile, MemberProfile, playerKey, updateProfile } from '../game-data.js';
import { SendableMessage } from '../shared/conversation.js';
import { memberProfile } from '../shared/member.js';
import type { CombatData } from '../combat/combat.js';
import { applySubmit, emptySide, prefillNote, sideText, SideForm } from '../combat/combat-form.js';
import { combatData, mySide, prefillSide, profilesByPlayer, sideModal } from '../combat/sides.js';
import { attackerLine, attackerName, MAX_ATTACKERS, passDetail, reportText, runRaz, RazState } from './raz-format.js';
import type { RazPlan } from './raz.js';

const COLOR = 0x9a3412;
/** Une fiche reste modifiable 3 h après la dernière action (gardée en mémoire du bot). */
const SESSION_TTL_MS = 3 * 3600_000;
const HISTORY_SIZE = 2;

const HELP = [
  '**Simu raz** — plusieurs attaquants l’un après l’autre sur la même défense, dans l’ordre optimisé (crashs compris) :',
  '`!raz <défenseur>` : fiche préremplie avec ce qu’on sait de lui, puis ➕ pour ajouter les attaquants',
  '`!raz <défenseur> : <attaquant>, <attaquant>, moi` : avec les attaquants d’un coup, ex. `!raz Konan : Tard, Abimaru, moi`',
  '-# Un attaquant relié à Discord est prérempli avec ses niveaux (`!mesNiveaux`) et son armée disponible (`!dispo`).',
  '▶️ **Simuler le raz** donne l’ordre de passage ; le menu 🔍 détaille chaque passage.',
  '`!razHisto` : tes 2 derniers raz · `!razHisto 1` : le rouvrir',
].join('\n');

/** Raz enregistré dans l'historique d'un membre. */
interface SavedRaz {
  at: number;
  defender: SideForm;
  attackers: SideForm[];
  healedReturn: boolean;
}

const fiches = new Map<string, { state: RazState; expires: number }>();
const reports = new Map<string, { state: RazState; plan: RazPlan; expires: number }>();

const now = () => Date.now();
function cleanup(): void {
  for (const map of [fiches, reports]) for (const [id, s] of map) if (s.expires < now()) map.delete(id);
}

// --- Commandes ---

export async function handleSimuRaz(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  switch (command.toLowerCase()) {
    case '!raz':
      return newRaz(message, rest.join(' '));
    case '!razhisto':
      return history(message, rest[0]);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

/** Attaquant d'après un nom (ou « moi ») : niveaux du membre relié et son armée disponible si on la connaît. */
function attackerFor(name: string, me: MemberProfile, members: Map<string, MemberProfile>): SideForm {
  const withArmy = (side: SideForm, profile: MemberProfile | undefined): SideForm =>
    profile?.available ? { ...side, troops: { ...profile.available } } : side;
  if (/^moi$/i.test(name)) return withArmy(mySide(me, members), me);
  const prefilled = prefillSide(name, members);
  if (!prefilled) return { ...emptySide(), player: name };
  // Un attaquant est un membre du clan : on ne garde pas une « dernière armée connue » d'ennemi.
  return withArmy({ ...prefilled, troops: { genin: null, chuunin: null, jounin: null } }, members.get(playerKey(prefilled.player)));
}

async function newRaz(message: SendableMessage, query: string): Promise<void> {
  const data = combatData();
  if (!data) return void (await message.reply('Les données de jeu ne sont pas encore chargées, réessaie dans quelques secondes.'));
  const [defenderName, attackersText = ''] = query.split(/\s*:\s*/);
  if (!defenderName.trim()) return void (await message.reply(HELP));

  const [me, members] = await Promise.all([memberProfile(message), profilesByPlayer()]);
  const notes: string[] = [];
  const defender = prefillSide(defenderName.trim(), members);
  if (!defender) notes.push(`« ${defenderName.trim()} » n'est pas dans la liste des joueurs : renseigne sa défense avec ✏️ Défenseur.`);
  else if (Object.values(defender.troops).every((t) => t === null)) notes.push(`Armée de ${defender.player} inconnue : renseigne-la avec ✏️ Défenseur.`);

  const attackers = attackersText
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, MAX_ATTACKERS)
    .map((n) => attackerFor(n, me, members));
  const state: RazState = { defender: defender ?? { ...emptySide(), player: defenderName.trim() }, attackers, healedReturn: true };
  const reply = await message.reply({ ...renderFiche(data, state), ...(notes.length ? { content: notes.join('\n') } : {}) });
  fiches.set(reply.id, { state, expires: now() + SESSION_TTL_MS });
}

async function history(message: SendableMessage, which: string | undefined): Promise<void> {
  const saved = ((await getProfile(message.author.id)).razHistory ?? []) as SavedRaz[];
  if (!saved.length) return void (await message.reply('Aucun raz dans ton historique : lance `!raz <défenseur>`.'));
  if (!which) {
    const lines = saved.map(
      (r, i) =>
        `**${i + 1}.** ${new Date(r.at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ` +
        `${r.defender.player || 'Défenseur'} · ${r.attackers.length} attaquant${r.attackers.length > 1 ? 's' : ''}`,
    );
    return void (await message.reply(`${lines.join('\n')}\n\`!razHisto 1\` pour rouvrir le premier.`));
  }
  const raz = saved[Number(which) - 1];
  const data = combatData();
  if (!raz || !data) return void (await message.reply(`Pas de raz n°${which} dans ton historique (\`!razHisto\` pour la liste).`));
  const state: RazState = { defender: raz.defender, attackers: raz.attackers, healedReturn: raz.healedReturn };
  const reply = await message.reply(renderFiche(data, state));
  fiches.set(reply.id, { state, expires: now() + SESSION_TTL_MS });
}

/** Garde ce raz en tête de l'historique du membre (sans doublon, 2 au plus). */
async function remember(userId: string, state: RazState): Promise<void> {
  const key = (r: Omit<SavedRaz, 'at'>) => JSON.stringify([r.defender, r.attackers, r.healedReturn]);
  const entry: SavedRaz = { at: now(), defender: state.defender, attackers: state.attackers, healedReturn: state.healedReturn };
  const previous = ((await getProfile(userId)).razHistory ?? []) as SavedRaz[];
  const next = [entry, ...previous.filter((r) => key(r) !== key(entry))].slice(0, HISTORY_SIZE);
  await updateProfile(userId, { razHistory: next });
}

// --- Fiche (saisie) ---

function renderFiche(data: CombatData, state: RazState) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`💥 Raz sur ${state.defender.player || 'le défenseur'}`)
    .addFields(
      { name: `🛡️ Défenseur${state.defender.player ? ` · ${state.defender.player}` : ''}`, value: sideText(data, state.defender, true) },
      {
        name: `🗡️ Attaquants (${state.attackers.length}/${MAX_ATTACKERS})`,
        value: state.attackers.length ? state.attackers.map((a, i) => attackerLine(data, a, i)).join('\n') : 'Aucun : ➕ pour en ajouter.',
      },
    )
    .setFooter({ text: `Genin / Chuunin / Jounin · soignés du défenseur ${state.healedReturn ? 'revenus' : 'non revenus'} entre deux passages` });

  const rows: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('raz:add').setLabel('➕ Attaquant').setStyle(ButtonStyle.Primary).setDisabled(state.attackers.length >= MAX_ATTACKERS),
      new ButtonBuilder().setCustomId('raz:editdef').setLabel('✏️ Défenseur').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('raz:removelast').setLabel('🗑️ Retirer le dernier').setStyle(ButtonStyle.Secondary).setDisabled(!state.attackers.length),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('raz:healed')
        .setLabel('🩹 Soignés du défenseur reviennent')
        .setStyle(state.healedReturn ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('raz:run').setLabel('▶️ Simuler le raz').setStyle(ButtonStyle.Danger).setDisabled(!state.attackers.length),
    ),
  ];
  if (state.attackers.length) {
    rows.splice(
      1,
      0,
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('raz:pick')
          .setPlaceholder('✏️ Modifier un attaquant…')
          .addOptions(state.attackers.map((a, i) => ({ label: `${i + 1}. ${attackerName(a, i)}`.slice(0, 100), value: String(i) }))),
      ),
    );
  }
  return { embeds: [embed], components: rows };
}

// --- Rapport ---

function renderReport(state: RazState, plan: RazPlan) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`📜 Rapport de raz · ${state.defender.player || 'Défenseur'}`)
    .setDescription(reportText(plan, state).slice(0, 4000))
    .setFooter({ text: 'Genin / Chuunin / Jounin · estimation, formules déduites de rapports' });
  const components = plan.passes.length
    ? [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('raz:detail')
            .setPlaceholder('🔍 Détail d’un passage…')
            .addOptions(
              plan.passes.map((p, i) => ({
                label: `${i + 1}. ${attackerName(state.attackers[p.attacker], p.attacker)} — ${p.crash ? 'Crash' : 'Passe'}`.slice(0, 100),
                value: String(i),
              })),
            ),
        ),
      ]
    : [];
  return { embeds: [embed], components };
}

// --- Interactions (identifiants « raz:… ») ---

const EXPIRED = 'Cette fiche a expiré (ou le bot a redémarré) : relance `!raz` ou `!razHisto 1`.';

export async function handleRazInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
  cleanup();
  const data = combatData();
  const messageId = interaction.message?.id ?? '';
  const [, action, arg] = interaction.customId.split(':');

  if (action === 'detail' && interaction.isStringSelectMenu()) {
    const report = reports.get(messageId);
    const pass = report?.plan.passes[Number(interaction.values[0])];
    if (!report || !pass) return void (await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral }));
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setDescription(passDetail(pass, Number(interaction.values[0]) + 1, report.state))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const fiche = fiches.get(messageId);
  if (!data || !fiche) return void (await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral }));
  fiche.expires = now() + SESSION_TTL_MS;
  const state = fiche.state;

  if (interaction.isButton()) {
    switch (action) {
      case 'add':
        return void (await interaction.showModal(sideModal('raz:modal:new', 'Nouvel attaquant', emptySide(), false)));
      case 'editdef':
        return void (await interaction.showModal(sideModal('raz:modal:def', 'Défenseur', state.defender, true)));
      case 'removelast':
        state.attackers.pop();
        break;
      case 'healed':
        state.healedReturn = !state.healedReturn;
        break;
      case 'run': {
        const plan = runRaz(data, state);
        // Le rapport est figé sur une copie : modifier la fiche ensuite ne le change pas.
        const snapshot: RazState = structuredClone(state);
        await interaction.reply(renderReport(snapshot, plan));
        const sent = await interaction.fetchReply();
        reports.set(sent.id, { state: snapshot, plan, expires: now() + SESSION_TTL_MS });
        await remember(interaction.user.id, snapshot);
        return;
      }
    }
    await interaction.update(renderFiche(data, state));
    return;
  }

  if (interaction.isStringSelectMenu() && action === 'pick') {
    const index = Number(interaction.values[0]);
    const attacker = state.attackers[index];
    if (!attacker) return void (await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral }));
    await interaction.showModal(sideModal(`raz:modal:${index}`, `Attaquant ${index + 1}`, attacker, false));
    return;
  }

  if (interaction.isModalSubmit() && action === 'modal' && interaction.isFromMessage()) {
    const text = (id: string) => (interaction.fields.fields.has(id) ? interaction.fields.getTextInputValue(id) : undefined);
    const members = await profilesByPlayer();
    const isDefender = arg === 'def';
    const current = isDefender ? state.defender : arg === 'new' ? emptySide() : state.attackers[Number(arg)];
    if (!current) return void (await interaction.reply({ content: EXPIRED, flags: MessageFlags.Ephemeral }));
    const me = await getProfile(interaction.user.id);
    const result = applySubmit(
      current,
      { player: text('player') ?? '', troops: text('troops') ?? '', levels: text('levels') ?? '', hospital: text('hospital') ?? '', wall: text('wall') },
      (name) => (isDefender ? prefillSide(name, members) : attackerFor(name, me, members)),
    );
    if ('error' in result) return void (await interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral }));
    if (isDefender) state.defender = result.side;
    else if (arg === 'new') state.attackers.push(result.side);
    else state.attackers[Number(arg)] = result.side;
    await interaction.update(renderFiche(data, state));
    const note = prefillNote(result.side, result.prefilled, text('player') ?? '');
    if (note) await interaction.followUp({ content: note, flags: MessageFlags.Ephemeral });
  }
}
