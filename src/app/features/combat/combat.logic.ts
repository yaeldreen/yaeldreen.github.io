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

/** Temps de production d'une unité, en minutes. */
export const PRODUCTION_MINUTES: Record<TroopKey, number> = { genin: 20, chuunin: 30, jounin: 50 };

/**
 * Temps pour reformer ces troupes, par type, en minutes. Chaque type se reforme dans son propre bâtiment,
 * en parallèle : le temps de reconstitution est le plus long des trois.
 */
export const productionMinutes = (troops: TroopCounts): TroopCounts =>
  Object.fromEntries(TROOPS.map((t) => [t.key, troops[t.key] * PRODUCTION_MINUTES[t.key]])) as TroopCounts;

export const rebuildMinutes = (troops: TroopCounts): number => Math.max(...Object.values(productionMinutes(troops)));

/** Points gagnés par ninja adverse tué. */
export const KILL_POINTS: Record<TroopKey, number> = { genin: 1, chuunin: 5, jounin: 10 };

/** Pertes de l'attaquant (en %) = coefficient × force défense / force attaque (déduit des rapports). */
export const ATTACKER_LOSS_FACTOR = 0.211;

/** Pertes du défenseur quand l'attaquant l'emporte : fourchette observée, règle encore inconnue. */
export const DEFENDER_LOSS_RANGE = { min: 0.5, max: 0.55 } as const;

/**
 * Quand la défense est la plus forte (4 rapports du 21 au 29/10, bonus inconnus) :
 * l'assaillant perd ≈ 33 % × défense / attaque, le défenseur 19 à 25 % × attaque / défense.
 */
export const DEFENSE_WINS = { attackerFactor: 0.33, defenderFactor: { min: 0.19, max: 0.25 } } as const;

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
  /** Part de l'armée du défenseur perdue (fourchette), null sans assaillant. */
  defenderLossRate: { min: number; max: number } | null;
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

/** Le jeu arrondit les troupes soignées à l'inférieur (11,08 → 11). */
const recovered = (losses: TroopCounts, ratePct: number): TroopCounts =>
  mapTroops((k) => Math.floor((losses[k] * ratePct) / 100));
const pointsFor = (killed: TroopCounts): number => TROOPS.reduce((sum, t) => sum + killed[t.key] * KILL_POINTS[t.key], 0);

/**
 * Chaque camp perd le même pourcentage de chaque type de troupe (arrondi).
 * Attaquant : ≈ 21,1 % de (défense / attaque), plafonné à 100 %.
 * Assaillant plus fort : il perd ≈ 21,1 % × (défense / attaque), le défenseur 50 à 55 %.
 * Défense plus forte : l'assaillant perd ≈ 33 % × (défense / attaque), le défenseur 19 à 25 % × (attaque / défense).
 * L'hôpital de chaque camp soigne ensuite une partie de ses pertes (les points restent comptés sur les tués).
 */
export function simulateCombat(attacker: Army, defender: Army): CombatResult {
  const attack = sideStats(attacker, false);
  const defense = sideStats(defender, true);
  const ratio = attack.strength > 0 ? defense.strength / attack.strength : null;
  const attackerWins = ratio !== null && ratio < 1;

  const attackerLossRate =
    ratio === null ? 0 : Math.min(1, (attackerWins ? ATTACKER_LOSS_FACTOR : DEFENSE_WINS.attackerFactor) * ratio);
  const attackerLosses = lossesAt(attacker.troops, attackerLossRate);
  const defenderLossRate =
    ratio === null
      ? null
      : attackerWins
        ? DEFENDER_LOSS_RANGE
        : { min: Math.min(1, DEFENSE_WINS.defenderFactor.min / ratio), max: Math.min(1, DEFENSE_WINS.defenderFactor.max / ratio) };
  const defenderLosses = defenderLossRate && {
    min: lossesAt(defender.troops, defenderLossRate.min),
    max: lossesAt(defender.troops, defenderLossRate.max),
  };
  const attackerRecoveryRate = recoveryRate(attacker);
  const defenderRecoveryRate = recoveryRate(defender);

  return {
    attack,
    defense,
    ratio,
    attackerWins,
    attackerLossRate,
    attackerLosses,
    defenderLossRate,
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
 * L'assaillant perd ≈ 21,1 % de la force de la défense et chaque type perd le même pourcentage : les temps de
 * reconstitution sont égaux quand on envoie les types en proportion de 1 / temps de production (15 Genin pour
 * 10 Chuunin pour 6 Jounin). Un type limité par l'armée disponible est envoyé en entier, les autres complètent.
 * On cherche le plus petit « temps par type » τ (n = τ / temps de production, borné par le disponible) qui
 * dépasse la force de la défense + `marginPct` %.
 */
export function optimalAttack(
  attacker: Omit<Army, 'troops'>,
  defender: Army,
  available: TroopCounts,
  marginPct: number,
): OptimalAttack {
  const noHospital = { ...attacker, levels: { ...attacker.levels, hospital: 0 }, hospitalTicket: false };
  const { unitPower } = sideStats({ ...noHospital, troops: mapTroops(() => 0) }, false);
  const target = sideStats(defender, true).strength * (1 + Math.max(0, marginPct) / 100);

  const armyAt = (tau: number): TroopCounts => mapTroops((k) => Math.min(available[k], Math.round(tau / PRODUCTION_MINUTES[k])));
  const strengthOf = (troops: TroopCounts): number => TROOPS.reduce((sum, t) => sum + troops[t.key] * unitPower[t.key], 0);

  const maxTau = Math.max(...TROOPS.map((t) => (available[t.key] + 1) * PRODUCTION_MINUTES[t.key]));
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

  const result = simulateCombat({ ...noHospital, troops }, defender);
  const enemy = result.defenderLosses;
  return {
    troops,
    enough: strengthOf(troops) > target,
    result,
    lostMinutes: productionMinutes(result.attackerLosses),
    enemyLostMinutes: enemy && { min: productionMinutes(enemy.min), max: productionMinutes(enemy.max) },
  };
}
