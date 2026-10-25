import { TRAVEL_SPEEDS } from '../../core/game-data/travel-speeds';

export interface BuildingLevel {
  level: number;
  buildTime: string;
  population: number;
  stone: number;
  wood: number;
  iron: number;
  food: number;
}

export interface TrainingLevel extends BuildingLevel {
  /** Puissance en % */ power: number;
  /** Vitesse de marche en % */ walkSpeed: number;
  /** Temps de déplacement par km (centièmes de seconde) */ centisecondsPerKm: number;
}

export interface PowerLevel extends BuildingLevel {
  /** Puissance en % */ power: number;
}

export interface HospitalLevel extends BuildingLevel {
  /** Récupération de troupe en % */ troopRecovery: number;
}

export interface WatchtowerLevel extends BuildingLevel {
  /** Informations débloquées à ce niveau */ comment: string;
}

export interface MineLevel extends BuildingLevel {
  /** Production de ressources par heure */ productionPerHour: number;
}

export interface WallLevel extends BuildingLevel {
  /** Défense en % */ defense: number;
}

export interface StorageLevel extends BuildingLevel {
  /** Capacité de stockage */ capacity: number;
}

export interface CouncilLevel extends BuildingLevel {
  /** Nombre de membres disponibles */ members: number;
}

/** [niveau, temps de construction, habitants, pierre, bois, fer, nourriture] */
type RawLevel = readonly [number, string, number, number, number, number, number];

const toLevel = ([level, buildTime, population, stone, wood, iron, food]: RawLevel): BuildingLevel => ({
  level, buildTime, population, stone, wood, iron, food,
});

const HQ_RAW: readonly RawLevel[] = [
  [1, '0:00:00:51', 2, 120, 100, 70, 50],
  [2, '0:00:03:20', 2, 540, 510, 510, 510],
  [3, '0:00:06:00', 2, 959, 910, 910, 910],
  [4, '0:00:10:48', 2, 1404, 1310, 1310, 1310],
  [5, '0:00:19:26', 2, 1977, 1830, 1830, 1830],
  [6, '0:00:34:59', 2, 2674, 2470, 2470, 2410],
  [7, '0:01:02:58', 3, 3495, 3210, 3210, 3210],
  [8, '0:01:53:20', 3, 4432, 4100, 4100, 4100],
  [9, '0:03:24:00', 3, 5533, 5020, 5020, 5020],
  [10, '0:06:07:12', 3, 6987, 6290, 6290, 6290],
  [11, '0:11:00:58', 3, 8808, 7864, 7830, 7830],
  [12, '0:19:49:44', 3, 11118, 9927, 9790, 9790],
  [13, '1:11:41:31', 4, 14034, 12530, 12240, 12240],
  [14, '2:16:14:44', 4, 17712, 15814, 15300, 15300],
  [15, '4:19:38:31', 4, 23675, 21138, 19120, 19120],
  [16, '8:16:09:20', 4, 30193, 26958, 25850, 25850],
  [17, '15:14:40:48', 4, 46775, 41763, 35081, 33411],
  [18, '28:02:25:26', 4, 69444, 62004, 52083, 49603],
  [19, '50:13:57:47', 4, 99944, 89236, 74958, 71389],
  [20, '91:01:08:01', 4, 140000, 125000, 105000, 100000],
];

const TRAINING_RAW: readonly RawLevel[] = [
  [1, '1min 47s', 2, 582, 582, 480, 379],
  [2, '9 min', 2, 910, 910, 634, 510],
  [3, '15 min', 2, 1310, 1310, 910, 910],
  [4, '26 min', 2, 1830, 1830, 1310, 1310],
  [5, '46 min', 3, 2470, 2470, 1830, 1830],
  [6, '1 h 19 min', 3, 3210, 3210, 2470, 2410],
  [7, '2 h 17 min', 3, 4100, 4100, 3210, 3210],
  [8, '3 h 59 min', 3, 5212, 5020, 4100, 4100],
  [9, '6 h 54 min', 3, 6590, 6290, 5020, 5020],
  [10, '12 h', 3, 8014, 7830, 6290, 6290],
  [11, '18 h 36 min', 3, 1190, 9790, 7830, 7830], // ⚠ pierre = 1 190 dans la source d'origine : probablement 11 190 ?
  [12, '1 j 4 h 50 min', 3, 14332, 12332, 10185, 9790],
  [13, '1 j 20 h 41 min', 4, 19114, 16279, 13444, 12240],
  [14, '2 j 21 h 15 min', 4, 25843, 21488, 17746, 15300],
  [15, '4 j 11 h 20 min', 4, 31866, 28364, 23425, 19120],
  [16, '6 j 22 h 21 min', 4, 43905, 37441, 30921, 25850],
  [17, '10 j 17 h 50 min', 4, 57954, 49422, 40815, 32209],
  [18, '16 j 15 h 38 min', 4, 76499, 65237, 53876, 42516],
  [19, '25 j 19 h 23 min', 4, 100979, 86112, 71117, 56121],
  [20, '40 j', 4, 133293, 113668, 93874, 74080],
];

const ACADEMY_RAW: readonly RawLevel[] = [
  [1, '2 min', 3, 220, 160, 175, 115],
  [2, '7 min', 3, 651, 484, 520, 341],
  [3, '11 min', 3, 910, 638, 910, 510],
  [4, '18 min', 3, 1310, 910, 1310, 910],
  [5, '30 min', 3, 1830, 1310, 1830, 1310],
  [6, '49 min', 4, 2470, 1830, 2470, 1830],
  [7, '1 h 20 min', 4, 3210, 2470, 3210, 2410],
  [8, '2 h 12 min', 4, 4100, 3210, 4100, 3210],
  [9, '3 h 38 min', 4, 5020, 4100, 5020, 4100],
  [10, '6 h', 4, 6290, 5020, 6290, 5020],
  [11, '10 h 55 min', 4, 7830, 6290, 7830, 6290],
  [12, '19 h 53 min', 4, 9790, 7830, 9790, 7830],
  [13, '1 j 12 h 12 min', 5, 12257, 10270, 12240, 9790],
  [14, '2 j 17 h 55 min', 5, 16005, 13558, 15300, 12240],
  [15, '5 j', 5, 20900, 17900, 19900, 16200],
  [16, '6 j 14 h 20 min', 5, 27336, 23646, 26350, 21831],
  [17, '8 j 16 h 56 min', 5, 35754, 31235, 34890, 29420],
  [18, '11 j 11 h 41 min', 5, 46764, 41261, 46199, 39647],
  [19, '15 j 3 h 46 min', 5, 61165, 54505, 61173, 53428],
  [20, '20 j', 5, 80000, 72000, 81000, 72000],
];

const CHUNNIN_RAW: readonly RawLevel[] = [
  [1, '6 min', 3, 1310, 1310, 1310, 910],
  [2, '10 min', 3, 1830, 1830, 1830, 1310],
  [3, '16 min', 3, 2470, 2470, 2470, 1830],
  [4, '27 min', 3, 3210, 3210, 3210, 2410],
  [5, '44 min', 3, 4100, 4100, 4100, 3210],
  [6, '1 h 13 min', 4, 5020, 5020, 5020, 4100],
  [7, '2 h', 4, 6290, 6290, 6290, 5020],
  [8, '3 h 19 min', 4, 7830, 7830, 7830, 6290],
  [9, '5 h 28 min', 4, 9790, 9790, 9790, 7830],
  [10, '9 h', 4, 12240, 12240, 12240, 9790],
  [11, '16 h 23 min', 4, 15399, 15300, 15300, 12240],
  [12, '1 j 5 h 50 min', 4, 21635, 20996, 21205, 15613],
  [13, '2 j 6 h 18 min', 5, 30397, 29118, 29655, 21969],
  [14, '4 j 2 h 52 min', 5, 42706, 40381, 41473, 30914],
  [15, '7 j 12 h', 5, 60000, 56000, 58000, 43500],
  [16, '9 j 21 h 31 min', 5, 74744, 69926, 72335, 55343],
  [17, '13 j 1 h 24 min', 5, 93111, 87316, 90214, 70411],
  [18, '17 j 5 h 32 min', 5, 115991, 109030, 112511, 89581],
  [19, '22 j 17 h 39 min', 5, 144493, 136143, 140319, 113970],
  [20, '30 j', 5, 180000, 170000, 175000, 145000],
];

const JOUNIN_RAW: readonly RawLevel[] = [
  [1, '10 min', 3, 7000, 6200, 6800, 5200],
  [2, '16 min', 3, 8387, 7456, 8144, 6207],
  [3, '27 min', 3, 10050, 8966, 9755, 7409],
  [4, '45 min', 3, 12041, 10782, 11683, 8844],
  [5, '1 h 14 min', 3, 14428, 12966, 13993, 10557],
  [6, '2 h 2 min', 4, 17288, 15592, 16760, 12602],
  [7, '3 h 21 min', 4, 20714, 18750, 20073, 15042],
  [8, '5 h 31 min', 4, 24819, 22548, 24042, 17956],
  [9, '9 h 6 min', 4, 29738, 27115, 28795, 21433],
  [10, '15 h', 4, 35632, 32607, 34488, 25584],
  [11, '1 j 3 h 19 min', 4, 42695, 39211, 41306, 30539],
  [12, '2 j 1 h 43 min', 4, 51156, 47153, 49473, 36453],
  [13, '3 j 18 h 31 min', 5, 61295, 56704, 59254, 43513],
  [14, '6 j 20 h 47 min', 5, 73444, 68189, 70969, 51941],
  [15, '12 j 12 h', 5, 88000, 82000, 85000, 62000],
  [16, '16 j 11 h 51 min', 5, 103495, 97007, 100356, 76559],
  [17, '21 j 18 h 20 min', 5, 121718, 114760, 118485, 94537],
  [18, '28 j 17 h 13 min', 5, 143150, 135762, 139891, 116737],
  [19, '37 j 21 h 26 min', 5, 168356, 160607, 165163, 144150],
  [20, '50 j', 5, 198000, 190000, 195000, 178000],
];

const WATCHTOWER_RAW: readonly RawLevel[] = [
  [1, '4 min', 3, 12000, 10000, 11000, 8000],
  [2, '8 min', 3, 13638, 11443, 12555, 9144],
  [3, '12 min', 3, 15501, 13094, 14329, 10453],
  [4, '20 min', 3, 17617, 14984, 16354, 11948],
  [5, '33 min', 3, 20022, 17146, 18665, 13657],
  [6, '54 min', 4, 22756, 19620, 21302, 15610],
  [7, '1 h 28 min', 4, 25863, 22451, 24313, 17844],
  [8, '2 h 25 min', 4, 29394, 25690, 27749, 20396],
  [9, '4 h', 4, 33407, 29398, 31670, 23314],
  [10, '6 h 36 min', 4, 37968, 33640, 36146, 26649],
  [11, '12 h 1 min', 4, 43152, 38494, 41254, 30461],
  [12, '21 h 52 min', 4, 49044, 44048, 47084, 34818],
  [13, '1 j 15 h 49 min', 5, 55740, 50404, 53738, 39799],
  [14, '3 j 31 min', 5, 63351, 57677, 61332, 45492],
  [15, '5 j 12 h', 5, 72000, 66000, 70000, 52000],
  [16, '7 j 6 h 10 min', 5, 87421, 80486, 85018, 64272],
  [17, '9 j 13 h 50 min', 5, 106145, 98151, 103259, 79440],
  [18, '12 j 15 h 15 min', 5, 128880, 119693, 125413, 98187],
  [19, '16 j 16 h 9 min', 5, 156484, 145964, 152320, 121359],
  [20, '22 j', 5, 190000, 178000, 185000, 150000],
];

const HOSPITAL_RAW: readonly RawLevel[] = [
  [1, '4 min', 2, 120, 85, 45, 55],
  [2, '7 min', 2, 540, 510, 251, 231],
  [3, '10 min', 2, 959, 910, 510, 411],
  [4, '17 min', 2, 1404, 1310, 910, 602],
  [5, '29 min', 2, 1977, 1830, 1310, 910],
  [6, '47 min', 3, 2674, 2470, 1830, 1310],
  [7, '1 h 16 min', 3, 3495, 3210, 2470, 1830],
  [8, '2 h 5 min', 3, 4432, 4100, 3210, 2410],
  [9, '3 h 27 min', 3, 5533, 5020, 4100, 3210],
  [10, '5 h 42 min', 3, 6987, 6290, 5020, 4100],
  [11, '10 h 22 min', 3, 8808, 7830, 6290, 5020],
  [12, '18 h 53 min', 3, 11118, 9790, 7830, 6290],
  [13, '1 j 10 h 23 min', 4, 14034, 12240, 9790, 7830],
  [14, '2 j 14 h 37 min', 4, 17712, 15300, 12240, 9790],
  [15, '4 j 18 h', 4, 23675, 19120, 15300, 12240],
  [16, '6 j 6 h 25 min', 4, 30193, 25850, 19120, 15300],
  [17, '8 j 6 h 29 min', 4, 46775, 33411, 25850, 20046],
  [18, '10 j 21 h 54 min', 4, 69444, 49603, 32242, 29762],
  [19, '14 j 9 h 35 min', 4, 99944, 71389, 46403, 42833],
  [20, '19 j', 4, 140000, 100000, 65000, 60000],
];

/** [production / h, ...RawLevel] (le niveau 0 donne la production de base). */
const MINE_RAW: readonly (readonly [number, ...RawLevel])[] = [
  [4, 0, '0', 0, 0, 0, 0, 0],
  [25, 1, '18 secondes', 2, 75, 90, 60, 45],
  [42, 2, '6 min', 2, 151, 181, 122, 92],
  [57, 3, '11 min', 2, 510, 510, 248, 186],
  [73, 4, '20 min', 2, 910, 910, 505, 510],
  [92, 5, '41 min', 2, 1310, 1476, 1027, 910],
  [118, 6, '1 h 10 min', 2, 1830, 1845, 1310, 1310],
  [151, 7, '2 h 23 min', 3, 2470, 2470, 1830, 1830],
  [196, 8, '3 h 41 min', 3, 3210, 3210, 2470, 2410],
  [254, 9, '5 h 41 min', 3, 4100, 4100, 3210, 3210],
  [328, 10, '8 h 58 min', 3, 5020, 5020, 4100, 4100],
  [420, 11, '13 h 27 min', 3, 6290, 6290, 5020, 5020],
  [534, 12, '20 h 11 min', 3, 7830, 7830, 6290, 6290],
  [671, 13, '1 j 6 h 16 min', 3, 9790, 9790, 7830, 7830],
  [834, 14, '1 j 21 h 25 min', 3, 12240, 12240, 9790, 9790],
  [1025, 15, '2 j 20 h 7 min', 3, 15300, 15300, 12240, 12240],
  [1248, 16, '4 j 6 h 11 min', 4, 19120, 21364, 15300, 15300],
  [1504, 17, '6 j 9 h 16 min', 4, 25850, 31137, 21661, 19120],
  [1797, 18, '9 j 13 h 54 min', 4, 37489, 45381, 31570, 25850],
  [2128, 19, '14 j 8 h 50 min', 4, 54639, 66142, 46012, 34509],
  [2500, 20, '21 j 13 h 16 min', 4, 79635, 96401, 67061, 50296],
];

export const HQ_LEVELS: readonly BuildingLevel[] = HQ_RAW.map(toLevel);

// Académie, Chunnin, Jounin : puissance nulle jusqu'au niveau 5, puis +6 %/niv. (90 % au niveau 20).
const withPower = (raw: RawLevel): PowerLevel => {
  const base = toLevel(raw);
  return { ...base, power: Math.max(0, (base.level - 5) * 6) };
};

export const ACADEMY_LEVELS: readonly PowerLevel[] = ACADEMY_RAW.map(withPower);
export const CHUNNIN_LEVELS: readonly PowerLevel[] = CHUNNIN_RAW.map(withPower);
export const JOUNIN_LEVELS: readonly PowerLevel[] = JOUNIN_RAW.map(withPower);

/** Commentaire par niveau (index 0 = niveau 1). */
const WATCHTOWER_COMMENTS: readonly string[] = [
  '1 armée en approche visible, aucune information',
  '2 armées en approche visibles',
  '2 armées visibles + nombre de Genins',
  '3 armées en approche visibles',
  '4 armées visibles + nombre de Chuunins + 1re armée en attente visible',
  '4 armées visibles + nombre de Jounins + Genins de la 1re armée en attente',
  '5 armées visibles + Chuunins de la 1re armée en attente',
  "5 armées visibles + temps restant et heure d'arrivée + Jounins de la 1re armée en attente",
  '6 armées visibles + 2e armée en attente visible',
  '7 armées visibles + type Attaque/Pillage + Genins de la 2e armée en attente',
  '8 armées visibles + Chuunins de la 2e armée en attente',
  '8 armées visibles + nom du joueur et village + Jounins de la 2e armée en attente',
  '9 armées visibles + 3e armée en attente visible',
  '10 armées visibles + Genins de la 3e armée en attente',
  '12 armées visibles + Chuunins de la 3e armée en attente',
  '14 armées visibles + Jounins de la 3e armée en attente',
  '16 armées visibles + 4e armée en attente visible',
  '18 armées visibles + Genins de la 4e armée en attente',
  '20 armées visibles + Chuunins de la 4e armée en attente',
  'Toutes les armées en approche visibles + Jounins de la 4e armée en attente',
];

export const WATCHTOWER_LEVELS: readonly WatchtowerLevel[] = WATCHTOWER_RAW.map((raw) => {
  const base = toLevel(raw);
  return { ...base, comment: WATCHTOWER_COMMENTS[base.level - 1] };
});

// Récupération : 10 % au niveau 1, +1 %/niv., mais saut à 30 % au niveau 20 (et non 29 %) d'après la source.
export const HOSPITAL_LEVELS: readonly HospitalLevel[] = HOSPITAL_RAW.map((raw) => {
  const base = toLevel(raw);
  return { ...base, troopRecovery: base.level === 20 ? 30 : 9 + base.level };
});

export const MINE_LEVELS: readonly MineLevel[] = MINE_RAW.map(([productionPerHour, ...raw]) => ({
  ...toLevel(raw),
  productionPerHour,
}));

/** [capacité, ...RawLevel] */
type StorageRawLevel = readonly [number, ...RawLevel];

const RESOURCE_DEPOT_RAW: readonly StorageRawLevel[] = [
  [900, 1, '55 sec', 2, 75, 80, 45, 30],
  [1305, 2, '4 min', 2, 157, 310, 94, 63],
  [1827, 3, '10 min', 2, 510, 610, 197, 134],
  [2468, 4, '22 min', 2, 910, 910, 510, 284],
  [3208, 5, '41 min', 3, 1431, 1451, 910, 600],
  [4098, 6, '1 h 9 min', 3, 1830, 2145, 1310, 910],
  [5010, 7, '1 h 56 min', 3, 2470, 2845, 1830, 1310],
  [6283, 8, '3 h 15 min', 3, 3210, 3914, 2470, 1830],
  [7829, 9, '5 h 30 min', 3, 4100, 4914, 3210, 2410],
  [9786, 10, '11 h', 3, 5020, 6145, 4100, 3210],
  [12233, 11, '18 h 24 min', 3, 6290, 7830, 5020, 4100],
  [15291, 12, '1 j 6 h 46 min', 3, 7830, 9790, 6290, 5020],
  [19114, 13, '2 j 3 h 28 min', 4, 9790, 12240, 7830, 6290],
  [25843, 14, '3 j 14 h 6 min', 4, 12240, 15300, 9790, 7830],
  [31866, 15, '6 j', 4, 15300, 19120, 12240, 9790],
  [51313, 16, '8 j 6 h 41 min', 4, 21224, 25850, 15300, 12240],
  [73666, 17, '11 j 10 h 8 min', 4, 30052, 32125, 19120, 15300],
  [109853, 18, '15 j 18 h 13 min', 4, 42552, 45487, 25850, 19120],
  [159106, 19, '21 j 17 h 50 min', 4, 60251, 64406, 36359, 25971],
  [209567, 20, '30 j', 4, 85313, 91196, 51482, 36773],
];

const FOOD_DEPOT_RAW: readonly StorageRawLevel[] = [
  [900, 1, '55 sec', 2, 60, 75, 40, 55],
  [1305, 2, '4 min', 2, 124, 155, 82, 114],
  [1827, 3, '10 min', 2, 510, 510, 166, 235],
  [2400, 4, '22 min', 2, 910, 910, 339, 510], // ⚠ 2 400 dans la source, contre 2 468 pour le Dépôt de ressources
  [3208, 5, '41 min', 3, 1310, 1357, 691, 1008],
  [4098, 6, '1 h 9 min', 3, 1830, 1830, 910, 1310],
  [5010, 7, '1 h 56 min', 3, 2470, 2470, 1310, 1830],
  [6283, 8, '3 h 15 min', 3, 3210, 3210, 1830, 2410],
  [7829, 9, '5 h 30 min', 3, 4100, 4100, 2470, 3210],
  [9786, 10, '11 h', 3, 5020, 5020, 3210, 4100],
  [12233, 11, '18 h 24 min', 3, 6290, 6290, 4100, 5020],
  [15291, 12, '1 j 6 h 46 min', 3, 7830, 7830, 5020, 6290],
  [19114, 13, '2 j 3 h 28 min', 4, 9790, 9790, 6290, 7830],
  [25843, 14, '3 j 14 h 6 min', 4, 12240, 12240, 7830, 9790],
  [31866, 15, '6 j', 4, 15300, 15300, 9790, 12240],
  [51313, 16, '8 j 6 h 41 min', 4, 19120, 20126, 12240, 15369],
  [73666, 17, '11 j 10 h 8 min', 4, 25850, 28498, 15300, 21761],
  [109853, 18, '15 j 18 h 13 min', 4, 33014, 40351, 20542, 30813],
  [159106, 19, '21 j 17 h 50 min', 4, 46746, 57135, 29086, 43630],
  [209567, 20, '30 j', 4, 66191, 80900, 41185, 61778],
];

const RESERVE_RAW: readonly StorageRawLevel[] = [
  [201, 1, '3 min', 2, 70, 80, 45, 40],
  [303, 2, '4 min 31 s', 2, 142, 163, 92, 81],
  [435, 3, '6 min 49 s', 2, 288, 510, 190, 164],
  [609, 4, '10 min 16 s', 2, 585, 910, 390, 333],
  [822, 5, '15 min 27 s', 3, 1186, 1371, 802, 675],
  [1089, 6, '23 min 17 s', 3, 1511, 1830, 1025, 865],
  [1336, 7, '35 min 5 s', 3, 1926, 2470, 1311, 1109],
  [1670, 8, '52 min 52 s', 3, 2470, 3210, 1830, 1422],
  [2088, 9, '1 h 19 min', 3, 3210, 4100, 2470, 1830],
  [2689, 10, '2 h', 3, 4100, 5020, 3210, 2410],
  [3260, 11, '2 h 45 min', 3, 5079, 6290, 4100, 3210],
  [4078, 12, '3 h 48 min', 3, 6473, 7830, 5020, 4100],
  [5097, 13, '5 h 15 min', 4, 8248, 9790, 6290, 5020],
  [6371, 14, '7 h 16 min', 4, 10511, 12240, 7830, 6310],
  [7964, 15, '10 h 2 min', 4, 13394, 15477, 9790, 8089],
  [9955, 16, '13 h 51 min', 4, 17068, 19722, 12240, 10369],
  [12444, 17, '19 h 8 min', 4, 21749, 25850, 15309, 13292],
  [15555, 18, '1 j 2 h 26 min', 4, 27714, 32024, 19574, 17039],
  [19444, 19, '1 j 12 h 29 min', 4, 35314, 40808, 25850, 21843],
  [24315, 20, '2 j 2 h 24 min', 4, 45000, 52000, 32000, 28000],
];

const toStorageLevel = ([capacity, ...raw]: StorageRawLevel): StorageLevel => ({ ...toLevel(raw), capacity });

export const RESOURCE_DEPOT_LEVELS: readonly StorageLevel[] = RESOURCE_DEPOT_RAW.map(toStorageLevel);
export const FOOD_DEPOT_LEVELS: readonly StorageLevel[] = FOOD_DEPOT_RAW.map(toStorageLevel);
export const RESERVE_LEVELS: readonly StorageLevel[] = RESERVE_RAW.map(toStorageLevel);

const RAPTOR_RAW: readonly RawLevel[] = [
  [1, '1 min 12 s', 2, 140, 160, 155, 105],
  [2, '1 min 50 s', 3, 241, 275, 268, 182],
  [3, '3 min', 3, 416, 510, 510, 315],
  [4, '4 min 54 s', 4, 717, 910, 910, 546],
  [5, '8 min', 4, 1235, 1397, 1375, 945],
];

export const RAPTOR_LEVELS: readonly BuildingLevel[] = RAPTOR_RAW.map(toLevel);

const WALL_RAW: readonly RawLevel[] = [
  [1, '2 min', 2, 120, 85, 45, 55],
  [2, '7 min', 2, 540, 510, 251, 231],
  [3, '10 min', 2, 959, 910, 510, 411],
  [4, '17 min', 2, 1404, 1310, 910, 602],
  [5, '29 min', 2, 1977, 1830, 1310, 910],
  [6, '47 min', 3, 2674, 2470, 1830, 1310],
  [7, '1 h 16 min', 3, 3495, 3210, 2470, 1830],
  [8, '2 h 5 min', 3, 4432, 4100, 3210, 2410],
  [9, '3 h 27 min', 3, 5533, 5020, 4100, 3210],
  [10, '5 h 42 min', 3, 6987, 6290, 5020, 4100],
  [11, '10 h 22 min', 3, 8808, 7830, 6290, 5020],
  [12, '18 h 53 min', 3, 11118, 9790, 7830, 6290],
  [13, '1 j 10 h 23 min', 4, 14034, 12240, 9790, 7830],
  [14, '2 j 14 h 37 min', 4, 17712, 15300, 12240, 9790],
  [15, '4 j 18 h', 4, 23675, 19120, 15300, 12240],
  [16, '6 j 6 h 25 min', 4, 30193, 25850, 19120, 15300],
  [17, '8 j 6 h 29 min', 4, 46775, 33411, 25850, 20046],
  [18, '10 j 21 h 54 min', 4, 69444, 49603, 32242, 29762],
  [19, '14 j 9 h 35 min', 4, 99944, 71389, 46403, 42833],
  [20, '19 j', 4, 140000, 100000, 65000, 60000],
];

// Défense : +2,5 %/niv. (50 % au niveau 20).
export const WALL_LEVELS: readonly WallLevel[] = WALL_RAW.map((raw) => {
  const base = toLevel(raw);
  return { ...base, defense: base.level * 2.5 };
});

// ⚠ Source partielle : niveaux 5 et 13 à 20 non communiqués.
const COMMERCE_RAW: readonly RawLevel[] = [
  [1, '4 min', 2, 120, 85, 45, 55], // habitants non affichés en jeu : 2 repris de l'Hôpital (grille identique)
  [2, '7 min', 2, 540, 510, 251, 231],
  [3, '10 min', 2, 959, 910, 510, 411],
  [4, '17 min', 2, 1404, 1310, 910, 602],
  [6, '47 min', 3, 2674, 2470, 1830, 1310],
  [7, '1 h 16 min', 3, 3495, 3210, 2470, 1830],
  [8, '2 h 5 min', 3, 4432, 4100, 3210, 2410],
  [9, '3 h 27 min', 3, 5533, 5020, 4100, 3210],
  [10, '5 h 42 min', 3, 6987, 6290, 5020, 4100],
  [11, '10 h 22 min', 3, 8808, 7830, 6290, 5020],
  [12, '18 h 53 min', 3, 11118, 9790, 7830, 6290],
];

export const COMMERCE_LEVELS: readonly BuildingLevel[] = COMMERCE_RAW.map(toLevel);

const HIGH_COUNCIL_RAW: readonly RawLevel[] = [
  [1, '1 min', 2, 180, 200, 140, 110],
  [2, '4 min 50 s', 2, 900, 900, 510, 198],
  [3, '8 min 54 s', 2, 1305, 1305, 910, 510],
  [4, '16 min 31 s', 2, 1827, 1827, 1310, 910],
  [5, '24 min 35 s', 3, 2468, 2468, 1830, 1310],
  [6, '36 min 37 s', 3, 3208, 3208, 2470, 1830],
  [7, '54 min 31 s', 3, 4098, 4098, 3210, 2410],
  [8, '1 h 21 min', 3, 5010, 5010, 4100, 3210],
  [9, '2 h', 3, 6283, 6283, 5020, 4100],
  [10, '3 h', 3, 7829, 7829, 6290, 5020],
  [11, '4 h 4 min', 3, 9786, 9786, 7830, 6290],
  [12, '5 h 32 min', 3, 12233, 12233, 9790, 7830],
  [13, '7 h 32 min', 4, 15291, 15291, 12240, 9790],
  [14, '10 h 15 min', 4, 19114, 19114, 15412, 12610],
  [15, '13 h 56 min', 4, 25843, 25843, 20063, 16443],
  [16, '18 h 57 min', 4, 31866, 31866, 26117, 21442],
  [17, '1 j 1 h 46 min', 4, 43243, 47811, 33999, 27961],
  [18, '1 j 11 h 2 min', 4, 56215, 62146, 44258, 36461],
  [19, '1 j 23 h 39 min', 4, 73078, 80780, 57614, 47546],
  [20, '2 j 16 h 48 min', 4, 95000, 105000, 75000, 62000],
];

// Aucun membre jusqu'au niveau 4, puis 10 au niveau 5 et +2/niv. (40 au niveau 20).
export const HIGH_COUNCIL_LEVELS: readonly CouncilLevel[] = HIGH_COUNCIL_RAW.map((raw) => {
  const base = toLevel(raw);
  return { ...base, members: base.level < 5 ? 0 : 10 + (base.level - 5) * 2 };
});

// Puissance (+2 %/niv.) et vitesse de marche (+5 %/niv.) sont linéaires ; la vitesse de
// déplacement vient de la table partagée (une seule source de vérité avec « Calcul Retour »).
export const TRAINING_CENTER_LEVELS: readonly TrainingLevel[] = TRAINING_RAW.map((raw) => {
  const base = toLevel(raw);
  return {
    ...base,
    power: base.level * 2,
    walkSpeed: base.level * 5,
    centisecondsPerKm: TRAVEL_SPEEDS[base.level - 1].centisecondsPerKm,
  };
});
