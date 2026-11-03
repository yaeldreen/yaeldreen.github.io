import { Attachment, EmbedBuilder, Message } from 'discord.js';
import { findPlayer, findVillage, gameData, getProfile, MapVillage, updateProfile } from '../game-data.js';
import { ask, isCancel, nextMessage, SendableMessage } from '../shared/conversation.js';
import { memberProfile } from '../shared/member.js';
import { parseParisTime } from '../shared/paris-time.js';
import { pickVillage } from '../shared/pick-village.js';
import { parseHistoryLines } from './history-line.js';
import { readReportImage } from './report-ocr.js';
import { returnsDescription, returnsTitle, ReturnsView } from './render.js';
import { distanceKm, returnRows, travelMs } from './travel.js';

const COLOR = 0x0e7490;
/** Heure à la fin d'une commande : « 21:39 », « 21:39:10 », « 21h39 », « 01/11 21:39:10 ». */
const TRAILING_TIME = /\s+((?:\d{1,2}\/\d{1,2}(?:\/\d{4})?\s+)?\d{1,2}\s*[:h]\s*\d{2}(?:\s*[:m]\s*\d{2}s?)?)$/i;

const HELP = [
  '**Retours** — heure de retour des troupes ennemies pour chaque niveau de CE (heures de Paris) :',
  '`!retourKm <km> [heure]` : distance connue, ex. `!retourKm 38,5 21:39:10`',
  '`!retourVillages <assaillant> > <défenseur> [heure]` : distance d’après la carte, ex. `!retourVillages Leaf village > Ninjed 21:39`',
  '`!retourVillages [heure]` seul : le bot te fait chercher et choisir les deux villages dans une liste',
  '`!retourRapport` + capture du rapport de combat : villages et heure lus dans l’image',
  '`!retourHisto <ligne du journal du clan>` : ex. `!retourHisto 03/11/2026 18:46 | Boboch a pillé Tombstone` (jusqu’à 5 lignes d’un coup)',
  'Sans heure, c’est maintenant. 🕐 sans ticket · 🎟️ avec ticket vitesse.',
  '',
  '**Retour faisable ?**',
  'Tu es relié automatiquement à ton joueur si ton pseudo correspond, et le bot te demande ton CE la première fois.',
  'Pour changer ton CE ou ta liaison : #gestion-joueurs (`!mesNiveaux`, `!monCE`, `!lier`).',
].join('\n');

const busy = new Set<string>();

export async function handleRetours(message: SendableMessage): Promise<void> {
  const [command, ...rest] = message.content.trim().split(/\s+/);
  const query = rest.join(' ');
  switch (command.toLowerCase()) {
    case '!retourkm':
      return byDistance(message, query);
    case '!retourvillages':
      return byVillages(message, query);
    case '!retourrapport':
      return byReport(message);
    case '!retourhisto':
      return byHistory(message);
    case '!aide':
      await message.reply(HELP);
      return;
  }
}

/** Sépare l'heure éventuelle à la fin de la commande ; sans heure, maintenant. */
function splitTime(text: string): { rest: string; attackedAtMs: number } | { error: string } {
  const m = TRAILING_TIME.exec(` ${text}`);
  if (!m) return { rest: text.trim(), attackedAtMs: Date.now() };
  const at = parseParisTime(m[1], Date.now());
  return at === null ? { error: `Heure illisible : « ${m[1]} ».` } : { rest: ` ${text}`.slice(0, m.index).trim(), attackedAtMs: at };
}

async function byDistance(message: SendableMessage, query: string): Promise<void> {
  const parsed = splitTime(query);
  if ('error' in parsed) return void (await message.reply(parsed.error));
  const km = Number(parsed.rest.replace(',', '.'));
  if (!parsed.rest || !Number.isFinite(km) || km <= 0) {
    await message.reply('Précise la distance en km : `!retourKm 38,5` (et l’heure d’attaque si ce n’est pas maintenant : `!retourKm 38,5 21:39:10`).');
    return;
  }
  await reply(message, { distanceKm: Math.round(km * 2) / 2, attackedAtMs: parsed.attackedAtMs });
}

async function byVillages(message: SendableMessage, query: string): Promise<void> {
  const parsed = splitTime(query);
  if ('error' in parsed) return void (await message.reply(parsed.error));
  // « !retourVillages » seul (ou avec une heure) : on fait choisir les deux villages.
  if (!parsed.rest) {
    if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
    busy.add(message.author.id);
    try {
      const attacker = await pickVillage(message, 'assaillant');
      if (!attacker) return;
      const defender = await pickVillage(message, 'défenseur');
      if (!defender) return;
      await reply(message, { attackedAtMs: parsed.attackedAtMs, attackerName: attacker.name, defenderName: defender.name });
    } finally {
      busy.delete(message.author.id);
    }
    return;
  }
  const [from, to] = parsed.rest.split(/\s*(?:>|->|→|\bvers\b)\s*/i);
  if (!from || !to) {
    await message.reply('Sépare les deux villages par `>` : `!retourVillages Leaf village > Ninjed 21:39`.');
    return;
  }
  await reply(message, { attackedAtMs: parsed.attackedAtMs, attackerName: from, defenderName: to });
}

const imageOf = (m: Message): Attachment | undefined =>
  m.attachments.find((a) => a.contentType?.startsWith('image/') ?? /\.(png|jpe?g|webp)$/i.test(a.name));

async function byReport(message: SendableMessage): Promise<void> {
  if (busy.has(message.author.id)) return void (await message.reply('Tu as déjà une question en cours : réponds-y ou `annuler`.'));
  busy.add(message.author.id);
  try {
    let image = imageOf(message);
    if (!image) {
      await message.channel.send(`${message.author} Envoie la capture du **rapport de combat**.\n-# Ou \`annuler\`.`);
      const answer = await nextMessage(message);
      if (!answer) return;
      image = imageOf(answer);
      if (!image) return void (await message.channel.send(isCancel(answer.content) ? 'Annulé.' : 'Pas de capture reçue.'));
    }
    await message.channel.send('🔎 Lecture du rapport…');
    const { sections, attackedAt } = await readReportImage(Buffer.from(await (await fetch(image.url)).arrayBuffer()));
    const villageOf = (side: string) => sections.find((s) => s.side === side)?.village ?? '';
    let attackedAtMs = attackedAt;
    if (attackedAtMs === null) {
      const answer = await ask(message, 'Je n’ai pas lu l’heure de l’attaque : laquelle ? (ex. `21:39` ou `31/10 21:39`)');
      if (answer === null) return;
      attackedAtMs = parseParisTime(answer, Date.now());
      if (attackedAtMs === null) return void (await message.channel.send(`Heure illisible : « ${answer} ».`));
    }
    const [attackerName, defenderName] = [villageOf('Assaillant'), villageOf('Défenseur')];
    if (!attackerName || !defenderName) {
      await message.channel.send(
        `Villages non lus sur la capture (${[!attackerName && 'assaillant', !defenderName && 'défenseur'].filter(Boolean).join(', ')}). ` +
          'Utilise `!retourVillages <assaillant> > <défenseur> <heure>`.',
      );
      return;
    }
    await reply(message, { attackedAtMs, attackerName, defenderName });
  } catch (error) {
    console.error(error);
    await message.channel.send('❌ Lecture du rapport impossible. Utilise `!retourVillages` ou `!retourKm`.');
  } finally {
    busy.delete(message.author.id);
  }
}

/** Lignes du journal d'attaques collées après la commande (une réponse par ligne, 5 au plus). */
async function byHistory(message: SendableMessage): Promise<void> {
  const text = message.content.replace(/^\s*!retourhisto\b/i, '');
  const lines = parseHistoryLines(text);
  if (!lines.length) {
    await message.reply('Colle une ligne du journal d’attaques du clan : `!retourHisto 03/11/2026 18:46 | Boboch a pillé Tombstone`.');
    return;
  }
  if (lines.length > 5) await message.reply(`${lines.length} lignes reçues : je calcule les 5 premières.`);
  await ensureMember(message);
  for (const line of lines.slice(0, 5)) {
    await reply(message, { attackedAtMs: line.attackedAtMs, attackerName: line.attacker, defenderName: line.defender, minutePrecision: true }, false);
  }
}

type Request = { attackedAtMs: number; minutePrecision?: boolean } & ({ distanceKm: number } | { attackerName: string; defenderName: string });

/** Fiches de retours récentes de chaque membre, recalculées quand il change son CE ou son village. */
const recent = new Map<string, { reply: Message; request: Request; at: number }[]>();
const RECENT_MAX = 5;
const RECENT_TTL_MS = 6 * 3600_000;

/** Membres qui ont répondu « passer » à la question du CE (on ne la repose pas avant le prochain redémarrage). */
export const ceSkipped = new Set<string>();

/**
 * Avant une fiche : relie le membre à son joueur d'après son pseudo si besoin, et lui demande son CE
 * la première fois (pour les ✅ / ❌), puis le retient.
 */
async function ensureMember(message: SendableMessage): Promise<void> {
  const profile = await memberProfile(message);
  if (profile.ce || ceSkipped.has(message.author.id)) return;
  const answer = await ask(
    message,
    'Quel est le niveau de ton **Camp d’entraînement** (CE) ? Je le retiens pour te dire si un retour est faisable (✅ / ❌).\n`passer` pour voir les retours sans.',
  );
  const level = Number(answer);
  if (answer !== null && Number.isInteger(level) && level >= 1 && level <= 20) {
    await updateProfile(message.author.id, { ce: level });
    await message.channel.send(`✅ CE ${level} retenu. Pour le changer plus tard : \`!monCE <niveau>\` dans #gestion-joueurs.`);
  } else {
    ceSkipped.add(message.author.id);
    if (answer !== null && !/^passer$/i.test(answer)) await message.channel.send('Niveau non compris : je montre les retours sans. `!monCE <niveau>` dans #gestion-joueurs pour le régler.');
  }
}

async function reply(message: SendableMessage, request: Request, prepare = true): Promise<void> {
  if (prepare) await ensureMember(message);
  const built = await buildEmbed(message.author.id, request);
  if ('error' in built) return void (await message.reply(built.error));
  const sent = await message.reply({ embeds: [built.embed] });
  const list = (recent.get(message.author.id) ?? []).filter((r) => Date.now() - r.at < RECENT_TTL_MS);
  recent.set(message.author.id, [{ reply: sent, request, at: Date.now() }, ...list].slice(0, RECENT_MAX));
}

/** Recalcule les dernières fiches du membre (✅ / ❌ depuis maintenant, avec ses nouveaux réglages). */
export async function refreshRecent(userId: string): Promise<number> {
  const list = (recent.get(userId) ?? []).filter((r) => Date.now() - r.at < RECENT_TTL_MS);
  let updated = 0;
  for (const { reply: sent, request } of list) {
    const built = await buildEmbed(userId, request);
    if ('error' in built) continue;
    try {
      await sent.edit({ embeds: [built.embed] });
      updated++;
    } catch {
      // Message supprimé entre-temps : rien à mettre à jour.
    }
  }
  return updated;
}

async function buildEmbed(userId: string, request: Request): Promise<{ embed: EmbedBuilder } | { error: string }> {
  const travel = gameData.travel;
  if (!travel) return { error: 'Les vitesses ne sont pas encore chargées, réessaie dans quelques secondes.' };

  let distance: number;
  let attacker: MapVillage | null = null;
  let route: string | undefined;
  if ('distanceKm' in request) distance = request.distanceKm;
  else {
    attacker = findVillage(request.attackerName);
    const defender = findVillage(request.defenderName);
    const missing = [!attacker && request.attackerName, !defender && request.defenderName].filter(Boolean);
    if (missing.length || !attacker || !defender) {
      return { error: `Village introuvable sur la carte : ${missing.map((m) => `« ${m} »`).join(', ')}. Vérifie l’orthographe (nom du village ou du joueur).` };
    }
    distance = distanceKm(attacker, defender);
    route = `${attacker.name} (${attacker.kage}) → ${defender.name} (${defender.kage})`;
  }

  // Contre-attaque : depuis le village du membre si on le connaît (et celui de l'assaillant), sinon il est le défenseur.
  const profile = await getProfile(userId);
  const nowMs = Date.now();
  let counter: ReturnsView['counter'];
  if (profile.ce) {
    const mine = profile.village ? findVillage(profile.village) : null;
    const fromMine = mine && attacker && mine.name !== attacker.name;
    const counterKm = fromMine ? distanceKm(mine, attacker!) : distance;
    counter = {
      level: profile.ce,
      distanceKm: counterKm,
      from: fromMine ? mine.name : 'le village attaqué',
      arrivalMs: nowMs + travelMs(travel, counterKm, profile.ce),
    };
  }

  const view: ReturnsView = {
    distanceKm: distance,
    attackedAtMs: request.attackedAtMs,
    route,
    counter,
    attackerCe: attacker ? (findPlayer(attacker.kage)?.ce ?? findPlayer(attacker.name)?.ce ?? null) : null,
    minutePrecision: request.minutePrecision,
    rows: returnRows(travel, distance, request.attackedAtMs, counter ? { level: counter.level, distanceKm: counter.distanceKm, nowMs } : null),
  };
  return {
    embed: new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(returnsTitle(view))
      .setDescription(returnsDescription(view))
      .setFooter({ text: 'Heures de Paris · 🕐 sans ticket · 🎟️ ticket vitesse · ✅ ta contre-attaque arrive avant' }),
  };
}

export const refreshedNote = (n: number): string => (n ? `\n🔄 ${n} fiche${n > 1 ? 's' : ''} de retours mise${n > 1 ? 's' : ''} à jour.` : '');
