/**
 * Simulation de combat (reprise de l'onglet « Simu combat » de l'appli web, calée sur des rapports réels).
 * Règles (gameData/combat) et bonus des bâtiments (gameData/buildings) viennent de Firestore.
 */
import type { Buildings } from '../build-guide/buildings.js';

export type TroopKey = 'genin' | 'chuunin' | 'jounin';
export type TroopCounts = Record<TroopKey, number>;
export const TROOP_KEYS: readonly TroopKey[] = ['genin', 'chuunin', 'jounin'];

/** Document gameData/combat. */
export interface CombatRules {
  basePower: TroopCounts;
  /** Temps de production d'une unité, en minutes. */ productionMinutes: TroopCounts;
  killPoints: TroopCounts;
  attackerLossFactor: number;
  defenderLossRange: { min: number; max: number };
  defenseWins: { attackerFactor: number; defenderFactor: { min: number; max: number } };
  combatTicketMultiplier: number;
  hospitalTicketBonus: number;
}

export interface CombatData {
  rules: CombatRules;
  buildings: Buildings;
}

export interface ArmyLevels {
  training: number;
  academy: number;
  chunnin: number;
  jounin: number;
  /** Ignoré en attaque. */ wall: number;
  hospital: number;
}

export interface Army {
  troops: TroopCounts;
  levels: ArmyLevels;
  hospitalTicket: boolean;
  /** Ticket attaque pour l'assaillant, ticket défense pour le défenseur. */ combatTicket: boolean;
}

export interface SideStats {
  /** Bonus total en %, par type de troupe (bonus additionnés). */ bonus: TroopCounts;
  /** Puissance d'une unité, bonus compris. */ unitPower: TroopCounts;
  /** Somme des puissances de l'armée. */ strength: number;
}

export interface CombatResult {
  attack: SideStats;
  defense: SideStats;
  /** Force défense / force attaque (null sans attaquant). */ ratio: number | null;
  attackerWins: boolean;
  attackerLossRate: number;
  attackerLosses: TroopCounts;
  defenderLossRate: { min: number; max: number } | null;
  defenderLosses: { min: TroopCounts; max: TroopCounts } | null;
  attackerPoints: { min: number; max: number } | null;
  defenderPoints: number;
  attackerRecoveryRate: number;
  defenderRecoveryRate: number;
  attackerRecovered: TroopCounts;
  defenderRecovered: { min: TroopCounts; max: TroopCounts } | null;
}

const mapTroops = (fn: (key: TroopKey) => number): TroopCounts =>
  Object.fromEntries(TROOP_KEYS.map((k) => [k, fn(k)])) as TroopCounts;

/** Valeur d'un effet (« power », « defense »…) d'un bâtiment à un niveau ; 0 si niveau 0 ou inconnu. */
const effectAt = (data: CombatData, building: string, key: string, level: number): number =>
  Number(data.buildings[building]?.levels.find((l) => l.level === level)?.[key]) || 0;

/**
 * Camp d'entraînement + centre du type de troupe (+ mur en défense), additionnés avant d'être appliqués,
 * puis ×1,2 avec le ticket attaque / défense.
 */
export function sideStats(data: CombatData, army: Army, defending: boolean): SideStats {
  const { training, academy, chunnin, jounin, wall } = army.levels;
  const common = effectAt(data, 'training', 'power', training) + (defending ? effectAt(data, 'wall', 'defense', wall) : 0);
  const bonus: TroopCounts = {
    genin: common + effectAt(data, 'academy', 'power', academy),
    chuunin: common + effectAt(data, 'chunnin', 'power', chunnin),
    jounin: common + effectAt(data, 'jounin', 'power', jounin),
  };
  const ticket = army.combatTicket ? data.rules.combatTicketMultiplier : 1;
  const unitPower = mapTroops((k) => data.rules.basePower[k] * (1 + bonus[k] / 100) * ticket);
  const strength = TROOP_KEYS.reduce((sum, k) => sum + army.troops[k] * unitPower[k], 0);
  return { bonus, unitPower, strength };
}

const lossesAt = (troops: TroopCounts, rate: number): TroopCounts => mapTroops((k) => Math.round(troops[k] * rate));

/** Récupération : celle de l'hôpital à son niveau, + le bonus du ticket (plafonnée à 100 %). */
export const recoveryRate = (data: CombatData, army: Army): number =>
  Math.min(100, effectAt(data, 'hospital', 'troopRecovery', army.levels.hospital) + (army.hospitalTicket ? data.rules.hospitalTicketBonus : 0));

/** Le jeu arrondit les troupes soignées à l'inférieur (11,08 → 11). */
const recovered = (losses: TroopCounts, ratePct: number): TroopCounts => mapTroops((k) => Math.floor((losses[k] * ratePct) / 100));
const pointsFor = (data: CombatData, killed: TroopCounts): number => TROOP_KEYS.reduce((sum, k) => sum + killed[k] * data.rules.killPoints[k], 0);

/**
 * Chaque camp perd le même pourcentage de chaque type de troupe (arrondi).
 * Assaillant plus fort : il perd ≈ 21,1 % × (défense / attaque), le défenseur 50 à 55 %.
 * Défense plus forte : l'assaillant perd ≈ 22 % × (défense / attaque)², le défenseur 23 à 26 % × (attaque / défense).
 * L'hôpital de chaque camp soigne ensuite une partie de ses pertes (les points restent comptés sur les tués).
 */
export function simulateCombat(data: CombatData, attacker: Army, defender: Army): CombatResult {
  const { rules } = data;
  const attack = sideStats(data, attacker, false);
  const defense = sideStats(data, defender, true);
  const ratio = attack.strength > 0 ? defense.strength / attack.strength : null;
  const attackerWins = ratio !== null && ratio < 1;

  const attackerLossRate =
    ratio === null ? 0 : Math.min(1, attackerWins ? rules.attackerLossFactor * ratio : rules.defenseWins.attackerFactor * ratio * ratio);
  const attackerLosses = lossesAt(attacker.troops, attackerLossRate);
  const defenderLossRate =
    ratio === null
      ? null
      : attackerWins
        ? rules.defenderLossRange
        : { min: Math.min(1, rules.defenseWins.defenderFactor.min / ratio), max: Math.min(1, rules.defenseWins.defenderFactor.max / ratio) };
  const defenderLosses = defenderLossRate && {
    min: lossesAt(defender.troops, defenderLossRate.min),
    max: lossesAt(defender.troops, defenderLossRate.max),
  };
  const attackerRecoveryRate = recoveryRate(data, attacker);
  const defenderRecoveryRate = recoveryRate(data, defender);

  return {
    attack,
    defense,
    ratio,
    attackerWins,
    attackerLossRate,
    attackerLosses,
    defenderLossRate,
    defenderLosses,
    attackerPoints: defenderLosses && { min: pointsFor(data, defenderLosses.min), max: pointsFor(data, defenderLosses.max) },
    defenderPoints: pointsFor(data, attackerLosses),
    attackerRecoveryRate,
    defenderRecoveryRate,
    attackerRecovered: recovered(attackerLosses, attackerRecoveryRate),
    defenderRecovered: defenderLosses && {
      min: recovered(defenderLosses.min, defenderRecoveryRate),
      max: recovered(defenderLosses.max, defenderRecoveryRate),
    },
  };
}

/**
 * Temps pour reformer ces troupes, par type, en minutes. Chaque type se reforme dans son propre bâtiment,
 * en parallèle : le temps de reconstitution est le plus long des trois.
 */
export const productionMinutes = (data: CombatData, troops: TroopCounts): TroopCounts =>
  mapTroops((k) => troops[k] * data.rules.productionMinutes[k]);

export const rebuildMinutes = (data: CombatData, troops: TroopCounts): number => Math.max(...Object.values(productionMinutes(data, troops)));

export interface OptimalAttack {
  troops: TroopCounts;
  /** false si toute l'armée disponible ne suffit pas à battre la défense (+ marge). */ enough: boolean;
  result: CombatResult;
  /** Temps pour reformer nos pertes, par type (minutes). */ lostMinutes: TroopCounts;
  /** Idem pour l'ennemi (fourchette de ses pertes). */ enemyLostMinutes: { min: TroopCounts; max: TroopCounts } | null;
}

/**
 * Armée dont les pertes se reforment le plus vite, prise dans l'armée disponible, sans hôpital.
 * Chaque type se reforme en parallèle dans son bâtiment : on minimise le plus long des trois temps.
 * Chaque type perd le même pourcentage : les temps de reconstitution sont égaux quand on envoie les types
 * en proportion de 1 / temps de production (15 Genin pour 10 Chuunin pour 6 Jounin). Un type limité par l'armée
 * disponible est envoyé en entier, les autres complètent. On cherche le plus petit « temps par type » τ
 * (n = τ / temps de production, borné par le disponible) qui dépasse la force de la défense + `marginPct` %.
 */
export function optimalAttack(data: CombatData, attacker: Omit<Army, 'troops'>, defender: Army, available: TroopCounts, marginPct: number): OptimalAttack {
  const minutes = data.rules.productionMinutes;
  const noHospital = { ...attacker, levels: { ...attacker.levels, hospital: 0 }, hospitalTicket: false };
  const { unitPower } = sideStats(data, { ...noHospital, troops: mapTroops(() => 0) }, false);
  const target = sideStats(data, defender, true).strength * (1 + Math.max(0, marginPct) / 100);

  const armyAt = (tau: number): TroopCounts => mapTroops((k) => Math.min(available[k], Math.round(tau / minutes[k])));
  const strengthOf = (troops: TroopCounts): number => TROOP_KEYS.reduce((sum, k) => sum + troops[k] * unitPower[k], 0);

  const maxTau = Math.max(...TROOP_KEYS.map((k) => (available[k] + 1) * minutes[k]));
  let troops: TroopCounts;
  if (strengthOf(available) <= target) {
    troops = { ...available };
  } else {
    let [low, high] = [0, maxTau];
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (strengthOf(armyAt(mid)) > target) high = mid;
      else low = mid;
    }
    troops = armyAt(high);
  }

  const result = simulateCombat(data, { ...noHospital, troops }, defender);
  const enemy = result.defenderLosses;
  return {
    troops,
    enough: strengthOf(troops) > target,
    result,
    lostMinutes: productionMinutes(data, result.attackerLosses),
    enemyLostMinutes: enemy && { min: productionMinutes(data, enemy.min), max: productionMinutes(data, enemy.max) },
  };
}
