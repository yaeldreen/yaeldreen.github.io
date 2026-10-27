import {
  ACADEMY_LEVELS,
  CHUNNIN_LEVELS,
  HOSPITAL_LEVELS,
  JOUNIN_LEVELS,
  PowerLevel,
  TRAINING_CENTER_LEVELS,
  WALL_LEVELS,
} from '../buildings/buildings.data';
import { TROOPS, TroopCounts, TroopKey } from '../enemies/enemies.model';

/** Puissance de base d'une unité, identique en attaque et en défense. */
export const BASE_POWER: Record<TroopKey, number> = { genin: 10, chuunin: 40, jounin: 60 };

/** Points gagnés par ninja adverse tué. */
export const KILL_POINTS: Record<TroopKey, number> = { genin: 1, chuunin: 5, jounin: 10 };

/** Pertes de l'attaquant (en %) = coefficient × force défense / force attaque (déduit des rapports). */
export const ATTACKER_LOSS_FACTOR = 0.211;

/** Pertes du défenseur quand l'attaquant l'emporte : fourchette observée, règle encore inconnue. */
export const DEFENDER_LOSS_RANGE = { min: 0.5, max: 0.55 } as const;

/** Ticket attaque (assaillant) ou défense (défenseur) : multiplie la puissance après les bonus additionnés. */
export const COMBAT_TICKET_MULTIPLIER = 1.2;

/** Le ticket hôpital ajoute 20 points de % de récupération. */
export const HOSPITAL_TICKET_BONUS = 20;

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
  /** Bonus total en %, par type de troupe (bonus additionnés). */ bonus: Record<TroopKey, number>;
  /** Puissance d'une unité, bonus compris. */ unitPower: Record<TroopKey, number>;
  /** Somme des puissances de l'armée. */ strength: number;
}

export interface CombatResult {
  attack: SideStats;
  defense: SideStats;
  /** Force défense / force attaque (null sans attaquant). */ ratio: number | null;
  attackerWins: boolean;
  attackerLossRate: number;
  attackerLosses: TroopCounts;
  /** null quand le défenseur l'emporte : aucun rapport observé dans ce cas. */
  defenderLosses: { min: TroopCounts; max: TroopCounts } | null;
  /** Points gagnés par l'assaillant (fourchette, d'après les pertes du défenseur). */
  attackerPoints: { min: number; max: number } | null;
  /** Points gagnés par le défenseur. */ defenderPoints: number;
  /** Part des pertes soignée par l'hôpital (+ ticket), en %. */
  attackerRecoveryRate: number;
  defenderRecoveryRate: number;
  attackerRecovered: TroopCounts;
  /** Même fourchette que les pertes du défenseur. */
  defenderRecovered: { min: TroopCounts; max: TroopCounts } | null;
}

const powerAt = (rows: readonly PowerLevel[], level: number): number => rows.find((r) => r.level === level)?.power ?? 0;
const wallAt = (level: number): number => WALL_LEVELS.find((r) => r.level === level)?.defense ?? 0;

const mapTroops = (fn: (key: TroopKey) => number): TroopCounts =>
  Object.fromEntries(TROOPS.map((t) => [t.key, fn(t.key)])) as TroopCounts;

/**
 * Camp d'entraînement + centre du type de troupe (+ mur en défense), additionnés avant d'être appliqués,
 * puis ×1,2 avec le ticket attaque / défense.
 */
export function sideStats(army: Army, defending: boolean): SideStats {
  const { training, academy, chunnin, jounin, wall } = army.levels;
  const common = powerAt(TRAINING_CENTER_LEVELS, training) + (defending ? wallAt(wall) : 0);
  const bonus: Record<TroopKey, number> = {
    genin: common + powerAt(ACADEMY_LEVELS, academy),
    chuunin: common + powerAt(CHUNNIN_LEVELS, chunnin),
    jounin: common + powerAt(JOUNIN_LEVELS, jounin),
  };
  const ticket = army.combatTicket ? COMBAT_TICKET_MULTIPLIER : 1;
  const unitPower = mapTroops((k) => BASE_POWER[k] * (1 + bonus[k] / 100) * ticket);
  const strength = TROOPS.reduce((sum, t) => sum + army.troops[t.key] * unitPower[t.key], 0);
  return { bonus, unitPower, strength };
}

const lossesAt = (troops: TroopCounts, rate: number): TroopCounts => mapTroops((k) => Math.round(troops[k] * rate));

/** Récupération : celle de l'hôpital à son niveau, + 20 % avec le ticket (plafonnée à 100 %). */
export const recoveryRate = (army: Army): number =>
  Math.min(100, (HOSPITAL_LEVELS.find((r) => r.level === army.levels.hospital)?.troopRecovery ?? 0) + (army.hospitalTicket ? HOSPITAL_TICKET_BONUS : 0));

const recovered = (losses: TroopCounts, ratePct: number): TroopCounts => lossesAt(losses, ratePct / 100);
const pointsFor = (killed: TroopCounts): number => TROOPS.reduce((sum, t) => sum + killed[t.key] * KILL_POINTS[t.key], 0);

/**
 * Chaque camp perd le même pourcentage de chaque type de troupe (arrondi).
 * Attaquant : ≈ 21,1 % de (défense / attaque), plafonné à 100 %.
 * Défenseur : 50 à 55 % quand l'attaquant est plus fort ; non modélisé sinon.
 * L'hôpital de chaque camp soigne ensuite une partie de ses pertes (les points restent comptés sur les tués).
 */
export function simulateCombat(attacker: Army, defender: Army): CombatResult {
  const attack = sideStats(attacker, false);
  const defense = sideStats(defender, true);
  const ratio = attack.strength > 0 ? defense.strength / attack.strength : null;
  const attackerWins = ratio !== null && ratio < 1;

  const attackerLossRate = ratio === null ? 0 : Math.min(1, ATTACKER_LOSS_FACTOR * ratio);
  const attackerLosses = lossesAt(attacker.troops, attackerLossRate);
  const defenderLosses = attackerWins
    ? { min: lossesAt(defender.troops, DEFENDER_LOSS_RANGE.min), max: lossesAt(defender.troops, DEFENDER_LOSS_RANGE.max) }
    : null;
  const attackerRecoveryRate = recoveryRate(attacker);
  const defenderRecoveryRate = recoveryRate(defender);

  return {
    attack,
    defense,
    ratio,
    attackerWins,
    attackerLossRate,
    attackerLosses,
    defenderLosses,
    attackerPoints: defenderLosses && { min: pointsFor(defenderLosses.min), max: pointsFor(defenderLosses.max) },
    defenderPoints: pointsFor(attackerLosses),
    attackerRecoveryRate,
    defenderRecoveryRate,
    attackerRecovered: recovered(attackerLosses, attackerRecoveryRate),
    defenderRecovered: defenderLosses && {
      min: recovered(defenderLosses.min, defenderRecoveryRate),
      max: recovered(defenderLosses.max, defenderRecoveryRate),
    },
  };
}
