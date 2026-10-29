import { ReportSide, TROOPS, TroopKey } from './enemies.model';

/** Mot reconnu par l'OCR, avec le centre de sa boîte. */
export interface OcrWord {
  text: string;
  x: number;
  y: number;
}

export type PartialCounts = Record<TroopKey, number | null>;

export interface ParsedReport {
  /** Nom affiché après « Ninjas de » : le village du joueur. */
  village: string;
  side: ReportSide | null;
  ninjas: PartialCounts;
  killed: PartialCounts;
}

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Confusions OCR courantes dans les nombres (O→0, l/I→1), puis seuls les chiffres. */
const digitsOf = (s: string): string => s.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/\D/g, '');

const isNumeric = (s: string): boolean => /^[\doOlI]+$/.test(s.replace(/[\s.,  ]/g, ''));

const HEADER_PREFIX: Record<TroopKey, string> = { genin: 'gen', chuunin: 'chu', jounin: 'jou' };

interface Section {
  village: string;
  side: ReportSide | null;
  columns: Record<TroopKey, number> | null;
  ninjasRow: readonly OcrWord[] | null;
  killedRow: readonly OcrWord[] | null;
}

/**
 * Lit les sections d'un rapport de combat (Assaillant, Défenseur…) à partir des lignes de mots de l'OCR.
 * Chaque section : « Ninjas de <village> », l'en-tête Genin / Chuunin / Jounin, puis les lignes « Ninjas » et « Tués ».
 * Les nombres sont rangés dans la colonne dont l'en-tête est le plus proche horizontalement,
 * ce qui recolle aussi un « 1 500 » découpé en deux mots.
 */
export function parseReport(lines: readonly (readonly OcrWord[])[]): ParsedReport[] {
  const sections: Section[] = [];
  const newSection = (village = '', side: ReportSide | null = null): Section => {
    const section: Section = { village, side, columns: null, ninjasRow: null, killedRow: null };
    sections.push(section);
    return section;
  };
  let current: Section | null = null;

  for (const line of lines) {
    const words = line.map((w) => norm(w.text));
    const deIndex = words.findIndex((w, i) => w === 'de' && words[i - 1] === 'ninjas');

    if (deIndex > 0) {
      const village = line
        .slice(deIndex + 1)
        .map((w) => w.text)
        .join(' ')
        .trim();
      const side = words.includes('assaillant')
        ? 'Assaillant'
        : words.some((w) => w.startsWith('defenseur'))
          ? 'Défenseur'
          : null;
      current = newSection(village, side);
      continue;
    }

    const header = Object.fromEntries(
      TROOPS.map(({ key }) => [key, line.find((w) => norm(w.text).startsWith(HEADER_PREFIX[key]))?.x]),
    ) as Record<TroopKey, number | undefined>;
    if (TROOPS.every(({ key }) => header[key] !== undefined)) {
      current ??= newSection();
      current.columns ??= header as Record<TroopKey, number>;
      continue;
    }

    if (words[0] === 'ninjas') {
      current ??= newSection();
      current.ninjasRow ??= line.slice(1);
    } else if (words[0]?.startsWith('tu')) {
      current ??= newSection();
      current.killedRow ??= line.slice(1);
    }
  }

  // Une section sans en-tête lisible reprend les colonnes de la précédente (même mise en page).
  let lastColumns: Record<TroopKey, number> | null = null;
  return sections
    .filter((s) => s.village || s.ninjasRow)
    .map((s) => {
      const columns = s.columns ?? lastColumns;
      lastColumns = columns;
      return { village: s.village, side: s.side, ninjas: readRow(s.ninjasRow, columns), killed: readRow(s.killedRow, columns) };
    });
}

/**
 * Heure du titre « Rapport de l’attaque | 25/10 à 06h11 » (heure locale, secondes à 0).
 * Le rapport n'indique pas l'année : on prend celle de `now`, ou la précédente si la date tomberait dans le futur.
 */
export function parseReportTime(lines: readonly (readonly OcrWord[])[], now = new Date()): number | null {
  for (const line of lines) {
    const text = line.map((w) => w.text).join(' ');
    if (!norm(text).includes('rapport')) continue;
    const m = /(\d{1,2})\s*\/\s*(\d{1,2})\D+?(\d{1,2})\s*h\s*(\d{2})/.exec(text.replace(/[oO](?=\d)|(?<=\d)[oO]/g, '0'));
    if (!m) continue;
    const [day, month, hours, minutes] = m.slice(1).map(Number);
    const at = (year: number) => new Date(year, month - 1, day, hours, minutes).getTime();
    const time = at(now.getFullYear());
    return time > now.getTime() + 86_400_000 ? at(now.getFullYear() - 1) : time;
  }
  return null;
}

function readRow(row: readonly OcrWord[] | null, columns: Record<TroopKey, number> | null): PartialCounts {
  const result: PartialCounts = { genin: null, chuunin: null, jounin: null };
  if (!row) return result;
  const numbers = row.filter((w) => isNumeric(w.text));

  if (!columns) {
    // Sans en-tête : on suppose les trois nombres dans l'ordre Genin, Chuunin, Jounin.
    TROOPS.forEach(({ key }, i) => (result[key] = numbers[i] ? Number(digitsOf(numbers[i].text)) : null));
    return result;
  }

  const digits: Record<TroopKey, string> = { genin: '', chuunin: '', jounin: '' };
  for (const word of [...numbers].sort((a, b) => a.x - b.x)) {
    const distance = (key: TroopKey): number => Math.abs(columns[key] - word.x);
    const nearest = TROOPS.map((t) => t.key).reduce((best, key) => (distance(key) < distance(best) ? key : best));
    digits[nearest] += digitsOf(word.text);
  }
  for (const { key } of TROOPS) result[key] = digits[key] ? Number(digits[key]) : null;
  return result;
}

/**
 * Lit un rapport copié en texte brut, sous l'une ou l'autre forme :
 * - « Assaillant — Ninjas de <village> », puis « Ninjas : 2 841 | 1 799 | 464 » et « Tués : 0 | 0 | 0 » ;
 * - copie du tableau du site : colonnes séparées par des tabulations (ou plusieurs espaces), sans « : ».
 * Une espace simple reste un séparateur de milliers (« 1 951 »). L'heure vient de « Rapport de l’attaque | 28/10 à 06h30 ».
 */
export function parseReportText(text: string, now = new Date()): { sections: ParsedReport[]; attackedAt: number | null } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sections: ParsedReport[] = [];
  let current: ParsedReport | null = null;

  for (const line of lines) {
    // Les valeurs commencent par un chiffre : « Ninjas de <village> » n'est pas une ligne de nombres.
    const row = /^(ninjas|tu[eé]s)\s*:?\s*(\d.*)$/i.exec(line);
    if (row) {
      if (!current) continue;
      const values = row[2].split(/\s*\|\s*|\t+|\s{2,}/).map((v) => v.replace(/\D/g, ''));
      const counts = Object.fromEntries(TROOPS.map((t, i) => [t.key, values[i] ? Number(values[i]) : null])) as PartialCounts;
      if (norm(row[1]).startsWith('ninjas')) current.ninjas = counts;
      else current.killed = counts;
      continue;
    }
    const header = /ninjas de\s+(.+)$/i.exec(line);
    if (header) {
      const start = norm(line);
      current = {
        village: header[1].trim(),
        side: start.startsWith('assaillant') ? 'Assaillant' : start.startsWith('defenseur') ? 'Défenseur' : null,
        ninjas: { genin: null, chuunin: null, jounin: null },
        killed: { genin: null, chuunin: null, jounin: null },
      };
      sections.push(current);
    }
  }

  const attackedAt = parseReportTime(lines.map((l) => [{ text: l, x: 0, y: 0 }]), now);
  return { sections, attackedAt };
}

/** Le texte ressemble à un rapport de combat copié (au moins une section « Ninjas de … »). */
export const looksLikeReportText = (text: string): boolean =>
  /ninjas de\s+\S/i.test(text) && /^\s*ninjas\s*:?\s*\d/im.test(text);
