import { ActionRowBuilder, ComponentType, StringSelectMenuBuilder } from 'discord.js';
import { config } from '../config.js';
import { gameData, MapVillage } from '../game-data.js';
import { ask, SendableMessage } from './conversation.js';

const MAX_CHOICES = 25;

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Villages dont le nom ou le joueur commence par la recherche, puis ceux qui la contiennent ; un nom exact passe seul. */
export function searchVillages(villages: readonly MapVillage[], query: string): MapVillage[] {
  const q = norm(query);
  if (!q) return [];
  const exact = villages.filter((v) => norm(v.name) === q || norm(v.kage) === q);
  if (exact.length === 1) return exact;
  const starts = villages.filter((v) => norm(v.name).startsWith(q) || norm(v.kage).startsWith(q));
  const contains = villages.filter((v) => !starts.includes(v) && (norm(v.name).includes(q) || norm(v.kage).includes(q)));
  const byName = (a: MapVillage, b: MapVillage) => a.name.localeCompare(b.name, 'fr');
  return [...starts.sort(byName), ...contains.sort(byName)];
}

/**
 * Fait choisir un village au membre : il tape le début du nom (village ou joueur), puis choisit dans une liste
 * déroulante si plusieurs correspondent. Null si abandon (« annuler », délai, trop d'essais).
 */
export async function pickVillage(
  message: SendableMessage,
  label: string,
  options: { question?: string; playersOnly?: boolean } = {},
): Promise<MapVillage | null> {
  // Pour un joueur, les villages neutres (sans joueur) ne sont pas proposés.
  const villages = options.playersOnly ? gameData.villages.filter((v) => !v.neutral) : gameData.villages;
  for (let attempt = 0; attempt < 3; attempt++) {
    const answer = await ask(message, options.question ?? `Quel est le village **${label}** ? Tape le début de son nom (ou de celui du joueur).`);
    if (answer === null) return null;
    const found = searchVillages(villages, answer);
    if (found.length === 1) return found[0];
    if (!found.length) {
      await message.channel.send(`Aucun village ne correspond à « ${answer} ».${attempt < 2 ? ' Réessaie.' : ' Abandon.'}`);
      continue;
    }
    const prompt = await message.channel.send({
      content: `${message.author} ${found.length} villages correspondent${found.length > MAX_CHOICES ? ` (les ${MAX_CHOICES} premiers ; tape plus de lettres pour affiner)` : ''} : choisis le village **${label}**.`,
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('pick:village')
            .setPlaceholder(`Village ${label}…`)
            .addOptions(
              found.slice(0, MAX_CHOICES).map((v, i) => ({
                label: v.name.slice(0, 100),
                description: `${v.kage}${v.neutral ? ' · neutre' : v.clan ? ` · ${v.clan}` : ''} · ${v.x} / ${v.y}`.slice(0, 100),
                value: String(i),
              })),
            ),
        ),
      ],
      allowedMentions: { users: [message.author.id] },
    });
    try {
      const choice = await prompt.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === message.author.id,
        time: config.answerTimeoutMs,
      });
      const village = found[Number(choice.values[0])];
      await choice.update({ content: `Village ${label} : **${village.name}** (${village.kage}).`, components: [] });
      return village;
    } catch {
      await prompt.edit({ content: 'Délai dépassé, choix abandonné.', components: [] }).catch(() => undefined);
      return null;
    }
  }
  return null;
}
