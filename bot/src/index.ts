import { Client, Events, GatewayIntentBits } from 'discord.js';
import { handleBuildGuide } from './build-guide/channel.js';
import { handleCalculSeconde } from './calcul-seconde/channel.js';
import { handleCombatInteraction, handleSimuCombat } from './combat/channel.js';
import { handleGestionInteraction, handleGestionJoueurs } from './gestion-joueurs/channel.js';
import { handleInfosEnnemis } from './infos-ennemis/channel.js';
import { handlePillages } from './pillages/channel.js';
import { handlePlusProche } from './plus-proche/channel.js';
import { handleRetours } from './retours/channel.js';
import { handleSimuConstru } from './simu-constru/channel.js';
import { handleRazInteraction, handleSimuRaz } from './simu-raz/channel.js';
import { config } from './config.js';
import { watchGameData } from './game-data.js';
import { clearChannel } from './shared/clear.js';
import { detachedReplies } from './shared/detached.js';

/**
 * Bot Discord de Tsukuyomi HUB : chaque salon correspond à un onglet de l'appli.
 * Les commandes commencent par « ! » et ne sont traitées que dans le salon de leur onglet ; elles sont supprimées
 * une fois traitées, et le bot répond dans le salon en nommant l'auteur.
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const CHANNEL_HANDLERS: Record<string, typeof handleBuildGuide> = {
  [config.channels.buildGuide]: handleBuildGuide,
  [config.channels.simuConstru]: handleSimuConstru,
  [config.channels.simuCombat]: handleSimuCombat,
  [config.channels.retours]: handleRetours,
  [config.channels.gestionJoueurs]: handleGestionJoueurs,
  [config.channels.plusProche]: handlePlusProche,
  [config.channels.infosEnnemis]: handleInfosEnnemis,
  [config.channels.pillages]: handlePillages,
  [config.channels.calculSeconde]: handleCalculSeconde,
  [config.channels.simuRaz]: handleSimuRaz,
};

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.inGuild() || !message.content.startsWith('!')) return;
  const handler = 'name' in message.channel ? CHANNEL_HANDLERS[message.channel.name] : undefined;
  if (!handler) return;
  // Les réponses vont dans le salon (pas « en réponse ») : la commande est supprimée une fois traitée.
  const command = detachedReplies(message);
  try {
    // « !clear » marche dans tous les salons du bot : vide le salon puis y remet son aide.
    if (/^!clear\b/i.test(message.content.trim())) await clearChannel(command, handler);
    else await handler(command);
  } catch (error) {
    console.error(error);
  } finally {
    // Supprimée après le traitement : les captures et fichiers joints ont déjà été lus. Il faut la permission « Gérer les messages ».
    await message.delete().catch(() => undefined);
  }
});

// Boutons, menus et formulaires des fiches (l'identifiant commence par le nom du salon : « combat:… », « raz:… », « gestion:… »).
client.on(Events.InteractionCreate, async (interaction) => {
  if (!(interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu())) return;
  try {
    if (interaction.customId.startsWith('combat:') && !interaction.isStringSelectMenu()) await handleCombatInteraction(interaction);
    else if (interaction.customId.startsWith('raz:')) await handleRazInteraction(interaction);
    else if (interaction.customId.startsWith('gestion:') && interaction.isButton()) await handleGestionInteraction(interaction);
  } catch (error) {
    console.error(error);
  }
});

client.once(Events.ClientReady, async (ready) => {
  console.log(`Connecté en tant que ${ready.user.tag}.`);
  // Retire les commandes « / » déclarées par une version précédente du bot (on est revenus aux commandes « ! »).
  if (config.guildId) await ready.application.commands.set([], config.guildId).catch(() => undefined);
});

watchGameData();
await client.login(config.token);
