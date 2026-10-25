export type TroopId = 'genin' | 'chunin' | 'jounin';

export interface TroopType {
  id: TroopId;
  label: string;
  /** Capacité de pillage par unité, pour chaque ressource. */
  capacity: number;
  dotClass: string;
  textClass: string;
}

export const TROOP_TYPES: readonly TroopType[] = [
  { id: 'genin', label: 'Genins', capacity: 13, dotClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
  { id: 'chunin', label: 'Chunins', capacity: 26, dotClass: 'bg-blue-500', textClass: 'text-blue-400' },
  { id: 'jounin', label: 'Jounins', capacity: 53, dotClass: 'bg-purple-500', textClass: 'text-purple-400' },
];
