/** Interprétation du texte lu (OCR) sur une capture « Coûts pour passer au niveau N » du jeu. */

export interface UpgradeCosts {
  stone: number;
  wood: number;
  iron: number;
  food: number;
  population: number;
  /** "1 j 10 h 23 min" */ buildTime: string;
}

/** Niveau visé d'après « … passer au niveau 13 » (ou « Faire évoluer au niveau 13 »). */
export function parseLevel(text: string): number | null {
  const m = /niveau\s*(\d{1,3})/i.exec(text);
  return m ? Number(m[1]) : null;
}

/** Durée telle que le jeu l'affiche, remise en forme : "1j10h23 min" → "1 j 10 h 23 min". */
// Une unité ne doit pas être suivie d'une lettre (« 1j10h » est collé, « 23 min » ne doit pas lire « 23 m »).
const TIME = /(\d+\s*j(?![a-z])\s*)?(\d+\s*h(?![a-z])\s*)?(\d+\s*min(?![a-z])\s*)?(\d+\s*s(?:ec)?(?![a-z]))?\s*$/i;

function normalizeTime(raw: string): string {
  return [...raw.matchAll(/(\d+)\s*(j|h|min|s(?:ec)?)(?![a-z])/gi)].map((m) => `${m[1]} ${m[2].toLowerCase().startsWith('s') ? 's' : m[2].toLowerCase()}`).join(' ');
}

/**
 * Le jeu passe aux jours au-delà de 23 h, aux heures au-delà de 59 min : « 1710 h 23 min » est un « 1 j 10 h »
 * mal lu (le « j » pris pour un 7).
 */
function isPlausibleTime(time: string): boolean {
  const max: Record<string, number> = { h: 23, min: 59, s: 59 };
  return !!time && [...time.matchAll(/(\d+) (j|h|min|s)/g)].every((m) => m[2] === 'j' || Number(m[1]) <= max[m[2]]);
}

/**
 * Ligne des coûts : « 14034 | 12240 | 9790 | 7830 | 4 | 1 j 10 h 23 min » (les icônes entre les nombres
 * sont ignorées). Il faut exactement 5 nombres (pierre, bois, fer, nourriture, habitants) puis une durée ;
 * sinon la lecture est jugée douteuse (null).
 */
export function parseCostsLine(text: string): UpgradeCosts | null {
  for (const line of text.split('\n')) {
    const time = TIME.exec(line);
    if (!time || !time[0].trim() || !/\d/.test(time[0])) continue;
    const before = line.slice(0, time.index);
    const numbers = [...before.matchAll(/\d+/g)].map((m) => Number(m[0]));
    if (numbers.length !== 5) continue;
    const [stone, wood, iron, food, population] = numbers;
    // Un niveau coûte quelques habitants (1 à 5 dans le jeu) : « 45 » trahit une icône lue comme un chiffre.
    if (population < 1 || population > 10 || [stone, wood, iron, food].some((n) => n < 1)) continue;
    const buildTime = normalizeTime(time[0]);
    if (!isPlausibleTime(buildTime)) continue;
    return { stone, wood, iron, food, population, buildTime };
  }
  return null;
}

/** Résultat le plus fréquent parmi plusieurs lectures (seuils différents) ; à égalité, le premier. */
export function mostCommon(readings: readonly (UpgradeCosts | null)[]): UpgradeCosts | null {
  const counts = new Map<string, { costs: UpgradeCosts; n: number }>();
  for (const r of readings) {
    if (!r) continue;
    const key = JSON.stringify(r);
    counts.set(key, { costs: r, n: (counts.get(key)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.costs ?? null;
}
