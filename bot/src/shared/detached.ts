import { Message, MessageCreateOptions, MessagePayload, MessageReplyOptions } from 'discord.js';
import { SendableMessage } from './conversation.js';

/**
 * Le message de commande, dont les réponses sont publiées dans le salon (et non « en réponse ») : la commande est
 * supprimée ensuite, et une réponse à un message supprimé s'afficherait « Message original supprimé ».
 * Chaque réponse commence par le nom de l'auteur, sans le notifier.
 */
export function detachedReplies(message: SendableMessage): SendableMessage {
  const reply = (payload: string | MessagePayload | MessageReplyOptions): Promise<Message<true>> => {
    const options = (typeof payload === 'string' ? { content: payload } : payload) as MessageCreateOptions;
    return message.channel.send({
      ...options,
      content: `${message.author} ${options.content ?? ''}`.trimEnd(),
      allowedMentions: options.allowedMentions ?? { parse: [] },
    });
  };
  return new Proxy(message, {
    get(target, property) {
      if (property === 'reply') return reply;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
