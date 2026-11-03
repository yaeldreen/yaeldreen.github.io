/**
 * Heures du jeu (heure de Paris), quel que soit le fuseau du serveur qui fait tourner le bot.
 */

const PARTS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface ParisParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function parisParts(ms: number): ParisParts {
  const p = Object.fromEntries(PARTS.formatToParts(ms).map((x) => [x.type, Number(x.value)]));
  return { year: p['year'], month: p['month'], day: p['day'], hour: p['hour'], minute: p['minute'], second: p['second'] };
}

/** Instant correspondant à une date et une heure de Paris (changements d'heure compris). */
export function parisToMs({ year, month, day, hour, minute, second }: ParisParts): number {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Décalage de Paris à cet instant : on corrige deux fois pour tomber juste autour d'un changement d'heure.
  let ms = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = parisParts(ms);
    ms += asUtc - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return ms;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "21:39:10" à l'heure de Paris. */
export const parisClock = (ms: number): string => {
  const p = parisParts(ms);
  return `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
};

/** "01/11" à Paris. */
export const parisDay = (ms: number): string => {
  const p = parisParts(ms);
  return `${pad(p.day)}/${pad(p.month)}`;
};

/**
 * Heure tapée par un joueur, à Paris : « 21:39 », « 21:39:10 », « 21h39 », « 21h39m10 », « 01/11 21:39:10 ».
 * Sans date : le jour même, ou la veille si l'heure n'est pas encore passée (une attaque est dans le passé).
 * Retourne null si le texte n'est pas une heure.
 */
export function parseParisTime(text: string, nowMs: number): number | null {
  const m = /^(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+)?(\d{1,2})\s*[:h]\s*(\d{2})(?:\s*[:m]\s*(\d{2})s?)?$/i.exec(text.trim());
  if (!m) return null;
  const [hour, minute, second] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (hour > 23 || minute > 59 || second > 59) return null;
  const now = parisParts(nowMs);
  if (m[1]) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : now.year;
    if (!m[3] && parisToMs({ year, month, day, hour, minute, second }) > nowMs + 86_400_000) year--;
    return parisToMs({ year, month, day, hour, minute, second });
  }
  const today = parisToMs({ ...now, hour, minute, second });
  return today > nowMs + 60_000 ? today - 86_400_000 : today;
}
