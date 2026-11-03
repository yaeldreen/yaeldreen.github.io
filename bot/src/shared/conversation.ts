import { Message } from 'discord.js';
import { config } from '../config.js';
import { findBuilding } from '../build-guide/buildings.js';
import { gameData } from '../game-data.js';

/** Message reçu dans un salon d'un serveur (on peut y répondre et y attendre la suite). */
export type SendableMessage = Message<true>;

/** Le membre a le rôle autorisé à modifier les données (EDITOR_ROLE). */
export const hasEditorRole = (message: SendableMessage): boolean =>
  !!message.member?.roles.cache.some((role) => role.name === config.editorRole);

/** Attend le prochain message du même membre dans le salon ; null si délai dépassé. */
export async function nextMessage(message: SendableMessage): Promise<Message | null> {
  const replies = await message.channel.awaitMessages({
    filter: (m) => m.author.id === message.author.id,
    max: 1,
    time: config.answerTimeoutMs,
  });
  const reply = replies.first() ?? null;
  if (!reply) await message.channel.send(`${message.author} Délai dépassé, saisie abandonnée.`);
  return reply;
}

export const isCancel = (text: string): boolean => /^annuler$/i.test(text.trim());

/** Pose une question et attend la réponse du même membre ; null si « annuler » ou délai dépassé. */
export async function ask(message: SendableMessage, question: string): Promise<string | null> {
  // Seul l'auteur de la commande est notifié, même si la question cite d'autres membres.
  await message.channel.send({
    content: `${message.author} ${question}\n-# Réponds dans ce salon, ou \`annuler\`.`,
    allowedMentions: { users: [message.author.id] },
  });
  const answer = (await nextMessage(message))?.content.trim();
  if (!answer) return null;
  if (isCancel(answer)) {
    await message.channel.send('Saisie annulée.');
    return null;
  }
  return answer;
}


export function buildingsOrWarn(message: SendableMessage) {
  if (!gameData.buildings || !Object.keys(gameData.buildings).length) {
    void message.reply('Les données de jeu ne sont pas encore chargées (ou pas encore envoyées dans la base).');
    return null;
  }
  return gameData.buildings;
}

export function resolveBuilding(message: SendableMessage, query: string) {
  const buildings = buildingsOrWarn(message);
  if (!buildings) return null;
  const found = findBuilding(buildings, query);
  if ('key' in found) return found;
  void message.reply(
    found.candidates.length
      ? `Plusieurs bâtiments correspondent : ${found.candidates.join(', ')}. Précise lequel.`
      : `Bâtiment inconnu : « ${query} ». Tape \`!voir\` pour la liste.`,
  );
  return null;
}

