import { RESOURCES } from '../../core/game-data/resources';
import { formatNumber, formatSpeed } from '../../shared/utils/format';
import {
  ACADEMY_LEVELS,
  BuildingLevel,
  CHUNNIN_LEVELS,
  HOSPITAL_LEVELS,
  HospitalLevel,
  HQ_LEVELS,
  JOUNIN_LEVELS,
  MINE_LEVELS,
  MineLevel,
  PowerLevel,
  TRAINING_CENTER_LEVELS,
  TrainingLevel,
  WATCHTOWER_LEVELS,
  WatchtowerLevel,
  RESOURCE_DEPOT_LEVELS,
  FOOD_DEPOT_LEVELS,
  RESERVE_LEVELS,
  StorageLevel,
  RAPTOR_LEVELS,
  COMMERCE_LEVELS,
  WALL_LEVELS,
  WallLevel,
  HIGH_COUNCIL_LEVELS,
  CouncilLevel,
} from './buildings.data';

export interface Column<T> {
  header: string;
  headerClass?: string;
  cellClass?: string;
  // Syntaxe "méthode" volontaire : permet d'affecter un Column<Sous-type> à un Column<Type>.
  value(row: T): string | number;
}

export type BuildingId =
  | 'hq'
  | 'training'
  | 'academy'
  | 'chunnin'
  | 'jounin'
  | 'watchtower'
  | 'wall'
  | 'hospital'
  | 'mine'
  | 'resourceDepot'
  | 'foodDepot'
  | 'reserve'
  | 'raptor'
  | 'commerce'
  | 'highCouncil';

export interface BuildingGuide<T extends BuildingLevel = BuildingLevel> {
  id: BuildingId;
  label: string;
  icon: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
}

/** Niveaux requis pour construire le niveau 1 d'un bâtiment (arbre des constructions du jeu). */
export const PREREQUISITES: Partial<Record<BuildingId, Partial<Record<BuildingId, number>>>> = {
  training: { hq: 3 },
  academy: { hq: 3, training: 1 },
  chunnin: { hq: 6, academy: 5 },
  jounin: { hq: 12, chunnin: 5 },
  watchtower: { hq: 15, jounin: 10, wall: 8 },
  wall: { hq: 1 },
  hospital: { academy: 1 },
  resourceDepot: { hq: 1 },
  foodDepot: { hq: 1 },
  reserve: { hq: 1 },
  raptor: { hq: 2 },
  commerce: { hq: 5 },
  highCouncil: { hq: 3 },
};

const levelColumn: Column<BuildingLevel> = {
  header: 'Niveau du Centre',
  cellClass: 'font-bold text-red-300',
  value: (r) => `Niveau ${r.level}`,
};

/** Temps, habitants, puis une colonne par ressource. */
const costColumns: Column<BuildingLevel>[] = [
  { header: 'Temps de construction', cellClass: 'text-stone-200', value: (r) => r.buildTime },
  { header: "Nombre d'habitant", cellClass: 'text-stone-300', value: (r) => r.population },
  ...RESOURCES.map((res) => ({
    header: res.label,
    headerClass: res.headerClass,
    cellClass: res.cellClass,
    value: (r: BuildingLevel) => formatNumber(r[res.key]),
  })),
];

const [buildTimeColumn, ...otherCostColumns] = costColumns;

/** Colonnes communes à tous les bâtiments : les autres sont les effets propres au bâtiment (puissance, capacité…). */
export const COMMON_COLUMNS: ReadonlySet<Column<BuildingLevel>> = new Set([levelColumn, ...costColumns]);

const powerColumn: Column<PowerLevel> = {
  header: 'Puissance',
  headerClass: 'text-red-300',
  cellClass: 'text-red-300 font-semibold',
  value: (r) => `${r.power.toFixed(2)}%`,
};

const capacityColumn: Column<StorageLevel> = {
  header: 'Capacité',
  headerClass: 'text-emerald-300',
  cellClass: 'text-emerald-300 font-semibold',
  value: (r) => formatNumber(r.capacity),
};

const trainingColumns: Column<TrainingLevel>[] = [
  levelColumn,
  powerColumn,
  {
    header: 'Vitesse de marche',
    headerClass: 'text-cyan-300',
    cellClass: 'text-cyan-300',
    value: (r) => `${r.walkSpeed.toFixed(2)}%`,
  },
  {
    header: 'Vitesse déplacement / Km',
    headerClass: 'text-teal-300',
    cellClass: 'text-teal-300',
    value: (r) => formatSpeed(r.centisecondsPerKm, true),
  },
  buildTimeColumn,
  ...otherCostColumns,
];

export const BUILDING_GUIDES: readonly BuildingGuide[] = [
  {
    id: 'hq',
    label: 'Quartier Général',
    icon: '🏯',
    columns: [levelColumn, ...costColumns],
    rows: HQ_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'training',
    label: "Centre d'entraînement",
    icon: '🏋️',
    columns: trainingColumns,
    rows: TRAINING_CENTER_LEVELS,
  } satisfies BuildingGuide<TrainingLevel>,
  {
    id: 'academy',
    label: 'Académie',
    icon: '🎓',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: ACADEMY_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'chunnin',
    label: 'Centre Chunnin',
    icon: '🥷',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: CHUNNIN_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'jounin',
    label: 'Centre Jounin',
    icon: '🛡️',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: JOUNIN_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'watchtower',
    label: 'Tour de Garde',
    icon: '🗼',
    columns: [
      levelColumn,
      ...costColumns,
      {
        header: 'Commentaire',
        cellClass: 'text-stone-300 font-sans whitespace-normal min-w-64',
        value: (r) => r.comment,
      },
    ],
    rows: WATCHTOWER_LEVELS,
  } satisfies BuildingGuide<WatchtowerLevel>,
  {
    id: 'wall',
    label: "Mur d'enceinte",
    icon: '🧱',
    columns: [
      levelColumn,
      { header: 'Défense', headerClass: 'text-sky-300', cellClass: 'text-sky-300 font-semibold', value: (r) => `${r.defense.toFixed(2)}%` },
      ...costColumns,
    ],
    rows: WALL_LEVELS,
  } satisfies BuildingGuide<WallLevel>,
  {
    id: 'hospital',
    label: 'Hôpital',
    icon: '🏥',
    columns: [
      levelColumn,
      ...costColumns,
      {
        header: 'Récupération de troupe',
        headerClass: 'text-emerald-300',
        cellClass: 'text-emerald-300 font-semibold',
        value: (r) => `${r.troopRecovery.toFixed(2)}%`,
      },
    ],
    rows: HOSPITAL_LEVELS,
  } satisfies BuildingGuide<HospitalLevel>,
  {
    id: 'mine',
    label: 'Mine de ressources',
    icon: '⛏️',
    columns: [
      levelColumn,
      {
        header: 'Production / h',
        headerClass: 'text-emerald-300',
        cellClass: 'text-emerald-300 font-semibold',
        value: (r) => formatNumber(r.productionPerHour),
      },
      ...costColumns,
    ],
    rows: MINE_LEVELS,
  } satisfies BuildingGuide<MineLevel>,
  {
    id: 'resourceDepot',
    label: 'Dépôt de ressources',
    icon: '🏚️',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: RESOURCE_DEPOT_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'foodDepot',
    label: 'Dépôt de nourriture',
    icon: '🌾',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: FOOD_DEPOT_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'reserve',
    label: 'Réserve',
    icon: '📦',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: RESERVE_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'raptor',
    label: 'Élevage de Rapaces',
    icon: '🦅',
    columns: [levelColumn, ...costColumns],
    rows: RAPTOR_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'commerce',
    label: 'Commerce',
    icon: '🏪',
    columns: [levelColumn, ...costColumns],
    rows: COMMERCE_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'highCouncil',
    label: 'Haut Conseil',
    icon: '🏛️',
    columns: [
      levelColumn,
      ...costColumns,
      {
        header: 'Membres disponibles',
        headerClass: 'text-emerald-300',
        cellClass: 'text-emerald-300 font-semibold',
        value: (r) => r.members,
      },
    ],
    rows: HIGH_COUNCIL_LEVELS,
  } satisfies BuildingGuide<CouncilLevel>,
];
