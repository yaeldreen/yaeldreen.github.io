import { RESOURCES } from '../../core/game-data/resources';
import { Column } from '../../shared/ui/data-table';
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
  HIGH_COUNCIL_LEVELS,
  CouncilLevel,
} from './buildings.data';

export type BuildingId =
  | 'hq'
  | 'training'
  | 'academy'
  | 'chunnin'
  | 'jounin'
  | 'watchtower'
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
    icon: 'fa-chess-rook',
    columns: [levelColumn, ...costColumns],
    rows: HQ_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'training',
    label: "Centre d'entraînement",
    icon: 'fa-dumbbell',
    columns: trainingColumns,
    rows: TRAINING_CENTER_LEVELS,
  } satisfies BuildingGuide<TrainingLevel>,
  {
    id: 'academy',
    label: 'Académie',
    icon: 'fa-graduation-cap',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: ACADEMY_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'chunnin',
    label: 'Centre Chunnin',
    icon: 'fa-user-ninja',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: CHUNNIN_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'jounin',
    label: 'Centre Jounin',
    icon: 'fa-user-shield',
    columns: [levelColumn, powerColumn, ...costColumns],
    rows: JOUNIN_LEVELS,
  } satisfies BuildingGuide<PowerLevel>,
  {
    id: 'watchtower',
    label: 'Tour de Garde',
    icon: 'fa-tower-observation',
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
    id: 'hospital',
    label: 'Hôpital',
    icon: 'fa-hospital',
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
    icon: 'fa-gem',
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
    icon: 'fa-warehouse',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: RESOURCE_DEPOT_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'foodDepot',
    label: 'Dépôt de nourriture',
    icon: 'fa-wheat-awn',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: FOOD_DEPOT_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'reserve',
    label: 'Réserve',
    icon: 'fa-box-archive',
    columns: [levelColumn, capacityColumn, ...costColumns],
    rows: RESERVE_LEVELS,
  } satisfies BuildingGuide<StorageLevel>,
  {
    id: 'raptor',
    label: 'Élevage de Rapaces',
    icon: 'fa-crow',
    columns: [levelColumn, ...costColumns],
    rows: RAPTOR_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'commerce',
    label: 'Commerce',
    icon: 'fa-store',
    columns: [levelColumn, ...costColumns],
    rows: COMMERCE_LEVELS,
  } satisfies BuildingGuide,
  {
    id: 'highCouncil',
    label: 'Haut Conseil',
    icon: 'fa-landmark',
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
