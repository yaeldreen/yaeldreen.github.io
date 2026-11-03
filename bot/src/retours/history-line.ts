import { parisToMs } from '../shared/paris-time.js';

/** Ligne du journal d'attaques du clan : « 03/11/2026 18:46 | Boboch a pillé Tombstone ». */
export interface HistoryLine {
  /** Heure affichée par le jeu (Paris), secondes à 0 : l'attaque a eu lieu dans la minute qui suit. */ attackedAtMs: number;
  attacker: string;
  defender: string;
  pillage: boolean;
}

const LINE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*\|\s*(.+?)\s+a\s+(pillé|attaqué)\s+(.+?)\s*$/i;

/** Lignes du journal dans un texte collé (une par ligne) ; les lignes illisibles sont ignorées. */
export function parseHistoryLines(text: string): HistoryLine[] {
  // Plusieurs lignes collées bout à bout (copie sans retours à la ligne) : on coupe avant chaque date.
  const lines = text.replace(/\s+(?=\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*\|)/g, '\n');
  return lines.split(/\r?\n/).flatMap((raw) => {
    const m = LINE.exec(raw.trim());
    if (!m) return [];
    const [day, month, year, hour, minute] = m.slice(1, 6).map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return [];
    return [{ attackedAtMs: parisToMs({ year, month, day, hour, minute, second: 0 }), attacker: m[6], defender: m[8], pillage: /pill/i.test(m[7]) }];
  });
}
