export type TroopKey = 'genin' | 'chuunin' | 'jounin';

export const TROOPS: readonly { key: TroopKey; label: string }[] = [
  { key: 'genin', label: 'Genin' },
  { key: 'chuunin', label: 'Chuunin' },
  { key: 'jounin', label: 'Jounin' },
];

export type TroopCounts = Record<TroopKey, number>;

/** Troupes restantes d'un joueur, d'après son dernier rapport (le plus récent remplace l'ancien). */
export interface EnemyRecord {
  player: string;
  troops: TroopCounts;
  side: ReportSide | null;
  /** Date ISO de l'enregistrement */ updatedAt: string;
}

export type ReportSide = 'Assaillant' | 'Défenseur';

export const playerKey = (name: string): string => name.trim().toLocaleLowerCase('fr');

export const totalTroops = (troops: TroopCounts): number => troops.genin + troops.chuunin + troops.jounin;

/** Restants = Ninjas − Tués (jamais négatif). */
export const survivors = (ninjas: TroopCounts, killed: TroopCounts): TroopCounts => ({
  genin: Math.max(0, ninjas.genin - killed.genin),
  chuunin: Math.max(0, ninjas.chuunin - killed.chuunin),
  jounin: Math.max(0, ninjas.jounin - killed.jounin),
});
