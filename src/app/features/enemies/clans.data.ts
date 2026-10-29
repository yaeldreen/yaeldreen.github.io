/** Infos saisies à la main sur un joueur (infos enemis), reprises par Simu combat. */
export const PLAYER_STATS = [
  { key: 'points', label: 'Points', short: 'Points', max: null },
  { key: 'inhabitants', label: 'Habitants', short: 'Hab.', max: null },
  { key: 'ce', label: 'CE estimé', short: 'CE', max: 20 },
  { key: 'academy', label: 'Académie', short: 'Acad.', max: 20 },
  { key: 'chunninCenter', label: 'Centre Chuunin', short: 'C. Chu', max: 20 },
  { key: 'jouninCenter', label: 'Centre Jounin', short: 'C. Jou', max: 20 },
  { key: 'hospital', label: 'Hôpital', short: 'Hôp.', max: 20 },
  { key: 'wall', label: "Mur d'enceinte", short: 'Mur', max: 20 },
] as const;

export type PlayerStatKey = (typeof PLAYER_STATS)[number]['key'];

export interface Player extends Partial<Record<PlayerStatKey, number | null>> {
  name: string;
  village: string;
  /** `null` = sans clan */ clan: string | null;
}

export interface Clan {
  name: string;
  players: readonly Player[];
}

export const NO_CLAN = 'Sans Clans';

/** Notre clan : connu pour reconnaître ses membres dans les rapports, mais absent des tableaux d'ennemis. */
export const OWN_CLAN = 'Tsukuyomi';

/** [joueur, village, clan] — `null` = sans clan (tiret dans la liste du jeu). */
type PlayerRow = readonly [string, string, string | null];

const SEED_ROWS: readonly PlayerRow[] = [
  ['Jakojak', 'Reggaeton', 'Yawata no Makai'],
  ['Personne', 'Nulle part', 'Yawata no Makai'],
  ['GhostDog', 'Guerre', 'Forsaken'],
  ['Sann', 'Pandoracity', 'Kuro No Kishidan'],
  ['Mouti', "Al'ancienne", 'Forsaken'],
  ['Hadès', 'Lymbes', null],
  ['TENZII', 'AREASAN', 'Kuro No Kishidan'],
  ['Snow', 'Winterfell', 'Tsukuyomi'],
  ['Neo', 'Matrice', null],
  ['BeuzzLaitier', 'La Loutres', 'Shi no Kitzu'],
  ['Drix', 'Weedland', 'Yawata no Makai'],
  ['Xaey', 'Lantia', null],
  ['Jouton', 'Haslet', 'Kuro No Kishidan'],
  ['SaltyMuta', 'Neko no ongaeshi', 'Yawata no Makai'],
  ['Shark', 'Shark bay', 'Yawata no Makai'],
  ['Gk68', 'GK68', 'Shi no Kitzu'],
  ['Serpent', 'Tard', 'Tsukuyomi'],
  ['Ody', 'Grèce', 'Forsaken'],
  ['atito', 'zriba', null],
  ['Renard', 'Zao', 'Yawata no Makai'],
  ['Cedo eloim', 'Boboch', 'Shi no Kitzu'],
  ['Kraken', 'AbySse', null],
  ['Shootzy', 'Optic Texas', 'Shi no Kitzu'],
  ['Livai', 'Livai', 'Shi no Kitzu'],
  ['ShitBirdz', 'BlOodyTampax', 'Shi no Kitzu'],
  ['Bob', 'Obo', 'Yawata no Makai'],
  ['Jued', 'Ninjed', 'Tsukuyomi'],
  ['Arich', 'Minas Tirith', 'Tsukuyomi'],
  ['Boruto sun', 'Lisiere city', 'Tsukuyomi'],
  ['Zozy', 'Kebekagure', 'Shi no Kitzu'],

  ['Jarhoïde', 'BigCity', 'Shi no Kitzu'],
  ['Roi de la Nuit', 'Marcheur Blanc', null],
  ['Madara', 'mirage', 'Forsaken'],
  ['Walaace', 'PalaaceW', 'Palace'],
  ['Jaa', 'Silforet', 'Shi no Kitzu'],
  ['Aizen', 'Soul-Society', 'Shi no Kitzu'],
  ['Kakashi', 'Kakashi', 'Forsaken'],
  ['Timon', 'Oasis', 'Yawata no Makai'],
  ['putin', 'Moscou', 'Forsaken'],
  ["On m'a forcé", 'Help', 'Tsukuyomi'],
  ['Turbo', 'Tourballe', 'Tsukuyomi'],
  ['Hashirama', 'SENJU', 'Kuro No Kishidan'],
  ['Palinuro', 'Rubicon', 'The Firm'],
  ['Griffon', 'Mystérieux', 'Kuro No Kishidan'],
  ['Maaminou', 'Memen', 'Shi no Kitzu'],
  ['Gogokage', 'Gogokage', 'Tsukuyomi'],
  ['Kane', 'Tombstone', 'Tsukuyomi'],
  ['Dragnir', 'Dragnir-City', 'The Firm'],
  ['Nat-Sirt', 'NTSRT', 'Kuro No Kishidan'],
  ['Asuma', 'Leaf village', null],
  ['Alpa', 'Le Fisc', 'Kuro No Kishidan'],
  ['WoW', 'WaW', 'Shi no Kitzu'],
  ['Peace sur moi', 'Golden shower', 'Shi no Kitzu'],
  ['Zarosaki', 'Shinsekai', 'Yawata no Makai'],
  ['Yaxoo', 'Pangea', 'Kuro No Kishidan'],
  ['Akke', 'Kibo', 'Shi no Kitzu'],
  ['Ectoplasma', 'Kanto', 'Forsaken'],
  ['Darrow', 'Lykos', 'Forsaken'],
  ['Fujitsu', 'Sioudaim', 'Shi no Kitzu'],
  ['Willie Gallon', 'Jaya', 'Tsukuyomi'],

  ['Jelly', 'Royaumebleu', null],
  ['Naruto', 'Konoha--', 'Forsaken'],
  ['Kenpachi', 'Gotei 13', 'Goteijūsantai'],
  ['Abimaru', 'Matelland', 'Tsukuyomi'],
  ['Pacers', 'Malice at the pa', 'The Firm'], // ⚠ village tronqué dans la capture
  ['ZONDA', 'SUPERWALL', 'Shi no Kitzu'],
  ['Muzan', 'Kibutsuji', 'Forsaken'],
  ['Solaire', "d'Astora", 'Kuro No Kishidan'],
  ['Shadow', 'Valyria', 'Tsukuyomi'],
  ['Hatsu', 'Zenitude', 'Tsukuyomi'],
  ['Wind', 'Kazeno', 'Kuro No Kishidan'],
  ['Timal', 'Konoha', 'Shi no Kitzu'],
  ['TheDeath', 'TheHell', 'Kuro No Kishidan'],
  ['Fatelz', 'OnCwak', null],
  ['Pain', 'Ame no Sato', 'Kuro No Kishidan'],
  ['Mononoule', 'Komoboule', null],
  ['Minimilk', 'Jidou', 'Kuro No Kishidan'],
  ['KageNoir_1802', 'Kurogane', null],
  ['Aeki', 'Soul Eater', 'Kuro No Kishidan'],
  ['Ei Sei', 'Qin', 'Tsukuyomi'],
  ['Yaelette', 'La giclette', 'Tsukuyomi'],
  ['Tajima', 'DetenuVille', 'Kuro No Kishidan'],
  ['Shieru', 'Phantom', 'Kuro No Kishidan'],
  ['MCi', 'ToMan', null],
  ['Konan', 'Yume', 'Kuro No Kishidan'],
  ['Sovitchi', 'Sovatuski', 'Kuro No Kishidan'],
  ['CÄFÄRDTUEUR', 'SPÄRTÄ', null],
  ['Gandika', 'Aurélia', 'Kuro No Kishidan'],
  ['Itachi-kun', 'Akatsuki', null],
  ['SaidChalandon', 'Chalandon', null],

  ['Shiinobii', 'Zerdiland', null],
  ['kyosh1ro', 'Luxville', 'Kuro No Kishidan'],
  ['kageGrimm', 'Citygrimm', null],
  ["L'épéeD'ophile", 'McBeat', null],
  ['Wailmart', 'Wailmart', 'Forsaken'],
  ['Deadlock', 'Frostpunk', null],
  ['Shin', 'Kuri no kuri', 'The Firm'],
  ['Cafard', 'Spartania', null],
  ['Jujutsu', 'Ryoiki Tenkai', null],
  ['Euclide', 'Alexandrie', null],
  ['BeuzLaitier', 'La Loutre', null],
  ['Ekat', 'Paillettes', null],
  ['Krake', 'Abyss', null],
  ['Prout', 'Prout prout', null],
  ['Testo', 'testa', null],
  ['Tonito', 'Seloncourt', null],
  ['globe', 'gliffe', null],
  ['AAAAAAAAAAAAAAAA', 'DDDDDDDDDDDDDD', null], // ⚠ nom coupé dans la capture, nombre de lettres incertain
  ['AAAAAA', 'AAAAAA', null],
  ['I-KiMi_iZuKi-I', 'Tsuki No Kuni', null],
  ['Walace', 'Palaace', null],
  ['Destress', 'Deshinobi', null],
  ['Asdechoc', 'Kanaxai', null],
  ['PinkyBea', 'BeaVilla', null],
  ['Mumu', 'Mumucity', null],
  ['CafardTueur', 'Sparta', null],
  ['Masakane', 'Masakane', null],
  ['Akaishin974', 'Kaminari974', null],
  ['Aka Wolf', 'Kurotsuki Land', null],
  ['hiltix', 'kadiköy', null],

  ['Adashitzu', 'Shitzu', null],
  ['Shino', 'LUVTENSA', null],
  ['Tipou', 'Pokeland', null],
  ['Powned', 'Utopia', null],
  ['Bilson', 'Kurogakure', null],
  ['Ho_kage', 'Kono_ha', null],
  ['Turnuroth', 'Arkhos', null],
  ['Zack Fair', 'Gongaga', null],
  ['Masashi', 'Spica', null],
  ['TheGhostify', 'Ghost City', null],
  ['Abn', 'Plm', null],
  ['Goyzueta', 'Mizugakure no Sa', null], // ⚠ village tronqué dans la capture
  ['Night', 'Killer', 'Akatsuki'],
  ['Big Meech', 'Blancherive', null],
  ['Tresor', 'Eden', null],
  ['Kyabetsu Uchiwa', 'Kasago', null],
  ['Oasis', 'Map', null],
  ['Leax', 'Xegonde', null],
  ['Feck-cameur', 'Puanto', null],
  ['Brandon', 'Brandon49', null],
  ['Douds', 'Landouge', null],
  ['Waka', 'Raccoon City', 'Akatsuki'],
  ['Shussei', 'Honoo', null],
  ['J Sàmá', 'Wuisix', null],
  ['Kuma', 'Sakana', null],
  ['Mochi', 'Tori', null],
  ['Itachi', 'Kanazawa', null],
  ['Vegeto', 'vegeto', null],
];

/**
 * Liste initiale (relevé du jeu). Copiée une seule fois dans Firestore au premier chargement ;
 * ensuite, clans et joueurs se gèrent depuis l'onglet « Infos ennemis ».
 */
export const SEED_PLAYERS: readonly Player[] = SEED_ROWS.map(([name, village, clan]) => ({ name, village, clan }));

export const SEED_CLANS: readonly string[] = [...new Set(SEED_PLAYERS.flatMap((p) => (p.clan ? [p.clan] : [])))];

const byClanName = (a: string, b: string): number => (a === NO_CLAN ? 1 : b === NO_CLAN ? -1 : a.localeCompare(b, 'fr'));

/**
 * Un groupe par clan existant (même vide), par ordre alphabétique, « Sans Clans » en dernier.
 * Un joueur rattaché à un clan supprimé est compté dans « Sans Clans ».
 */
export function groupByClan(players: readonly Player[], clanNames: readonly string[]): Clan[] {
  const known = new Set(clanNames);
  const groups = new Map<string, Player[]>(clanNames.map((name) => [name, []]));
  for (const player of players) {
    const clan = player.clan && known.has(player.clan) ? player.clan : NO_CLAN;
    groups.set(clan, [...(groups.get(clan) ?? []), player]);
  }
  return [...groups.entries()]
    .filter(([name, members]) => name !== NO_CLAN || members.length > 0)
    .sort(([a], [b]) => byClanName(a, b))
    .map(([name, members]) => ({ name, players: members }));
}

export interface PlayerMatch {
  player: Player;
  clan: string;
}

const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Retrouve un joueur à partir du nom lu dans un rapport (« Ninjas de <village> ») :
 * d'abord parmi les villages, puis parmi les noms de joueurs (casse et accents ignorés).
 */
export function findPlayer(players: readonly Player[], name: string): PlayerMatch | null {
  const target = normalize(name);
  if (!target) return null;
  for (const field of ['village', 'name'] as const) {
    const player = players.find((p) => normalize(p[field]) === target);
    if (player) return { player, clan: player.clan ?? NO_CLAN };
  }
  return null;
}
