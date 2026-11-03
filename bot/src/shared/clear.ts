import { Collection, Message, PermissionFlagsBits, Snowflake } from 'discord.js';
import { config } from '../config.js';
import { ask, hasEditorRole, SendableMessage } from './conversation.js';

/** Au-delà de 14 jours, Discord n'efface plus par lots : ces messages sont supprimés un par un. */
const BULK_MAX_AGE_MS = 14 * 24 * 3600_000 - 60_000;

/**
 * `!clear` : après confirmation, efface tous les messages du salon, puis y remet l'aide du salon
 * (comme si quelqu'un avait tapé `!aide`). Réservé au rôle éditeur.
 */
export async function clearChannel(message: SendableMessage, showHelp: (message: SendableMessage) => Promise<void>): Promise<void> {
  if (!hasEditorRole(message)) {
    await message.reply(`Seuls les membres avec le rôle « ${config.editorRole} » peuvent vider un salon.`);
    return;
  }
  const channel = message.channel;
  const me = channel.guild.members.me;
  if (!me || !channel.permissionsFor(me).has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
    await message.reply('Il me manque la permission **Gérer les messages** (et Voir l’historique) dans ce salon.');
    return;
  }
  const answer = await ask(message, `Effacer **tous** les messages de #${'name' in channel ? channel.name : 'ce salon'} ? C'est définitif. (\`oui\` / \`non\`)`);
  if (answer === null) return;
  if (!/^(oui|o|yes|y)$/i.test(answer)) {
    await channel.send('Rien n’a été effacé.');
    return;
  }

  const notice = await channel.send('🧹 Nettoyage du salon…');
  for (;;) {
    const batch: Collection<Snowflake, Message> = await channel.messages.fetch({ limit: 100 });
    const targets = batch.filter((m) => m.id !== notice.id);
    if (!targets.size) break;
    const recent = targets.filter((m) => Date.now() - m.createdTimestamp < BULK_MAX_AGE_MS);
    if (recent.size > 1) await channel.bulkDelete(recent, true);
    else if (recent.size === 1) await recent.first()!.delete().catch(() => undefined);
    for (const old of targets.filter((m) => !recent.has(m.id)).values()) await old.delete().catch(() => undefined);
  }
  await notice.delete().catch(() => undefined);

  // L'aide du salon, publiée directement (le message de la commande n'existe plus).
  const helpRequest = {
    content: '!aide',
    author: message.author,
    member: message.member,
    channel,
    guild: message.guild,
    attachments: new Collection(),
    mentions: message.mentions,
    inGuild: () => true,
    reply: (payload: Parameters<typeof channel.send>[0]) => channel.send(payload),
  } as unknown as SendableMessage;
  await showHelp(helpRequest);
}
