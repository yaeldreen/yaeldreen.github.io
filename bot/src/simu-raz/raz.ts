/** Simu raz (reprise de l'appli web) : plusieurs attaquants passent l'un après l'autre sur la même défense. */
import { Army, CombatData, CombatResult, sideStats, simulateCombat, TROOP_KEYS, TroopCounts } from '../combat/combat.js';

const TROOPS = TROOP_KEYS.map((key) => ({ key }));

export interface RazPass {
  /** Position de l'attaquant dans la liste saisie. */ attacker: number;
  /** L'attaquant perd son combat mais affaiblit la défense pour les suivants. */ crash: boolean;
  result: CombatResult;
  defenderBefore: TroopCounts;
  /** Pertes retenues pour le défenseur : le bas de la fourchette (prudent). */ defenderKilled: TroopCounts;
  defenderAfter: TroopCounts;
  /** Puissance perdue par l'attaquant / puissance tuée chez le défenseur (plus bas = mieux). */ lossRatio: number;
}

export interface RazPlan {
  passes: RazPass[];
  /** Attaquants qui n'ont plus rien à faire : la défense est déjà vide. */ unused: number[];
  /** Attaquants sans troupes, ignorés. */ empty: number[];
  wins: number;
  crashes: number;
  defenderRemaining: TroopCounts;
}

const sub = (a: TroopCounts, b: TroopCounts): TroopCounts =>
  Object.fromEntries(TROOPS.map((t) => [t.key, Math.max(0, a[t.key] - b[t.key])])) as TroopCounts;
const add = (a: TroopCounts, b: TroopCounts): TroopCounts =>
  Object.fromEntries(TROOPS.map((t) => [t.key, a[t.key] + b[t.key]])) as TroopCounts;
const powerOf = (troops: TroopCounts, unitPower: Record<keyof TroopCounts, number>): number =>
  TROOPS.reduce((sum, t) => sum + troops[t.key] * unitPower[t.key], 0);
const isEmpty = (troops: TroopCounts): boolean => TROOPS.every((t) => troops[t.key] === 0);

/**
 * Plan de « raz » : plusieurs attaquants passent l'un après l'autre sur la même défense, qui s'use à chaque combat.
 * - Tant qu'un attaquant peut gagner, le plus fort passe : une victoire retire toujours la même part de la défense
 *   (50 % au minimum) et coûte la même puissance (≈ 21 % de la défense restante) quel que soit l'attaquant ;
 *   envoyer les plus forts d'abord laisse aux plus faibles une défense déjà réduite.
 * - Sinon il faut un crash. On essaie chaque candidat et on garde celui qui permet ensuite le plus de victoires,
 *   puis le meilleur ratio puissance perdue / puissance tuée.
 * Les pertes du défenseur sont prises au bas de la fourchette. Avec `healedReturn`, les soignés de son hôpital
 * reviennent avant le passage suivant.
 */
export function planRaz(data: CombatData, attackers: readonly Army[], defender: Army, healedReturn: boolean): RazPlan {
  const strength = attackers.map((a) => sideStats(data, a, false).strength);
  const empty = attackers.flatMap((a, i) => (strength[i] > 0 ? [] : [i]));

  const fight = (i: number, troops: TroopCounts): RazPass => {
    const result = simulateCombat(data, attackers[i], { ...defender, troops });
    const killed = result.defenderLosses?.min ?? troops;
    const healed = healedReturn && result.defenderRecovered ? result.defenderRecovered.min : null;
    const after = healed ? add(sub(troops, killed), healed) : sub(troops, killed);
    const lost = powerOf(result.attackerLosses, result.attack.unitPower);
    const dealt = powerOf(killed, result.defense.unitPower);
    return {
      attacker: i,
      crash: !result.attackerWins,
      result,
      defenderBefore: troops,
      defenderKilled: killed,
      defenderAfter: after,
      lossRatio: dealt > 0 ? lost / dealt : Infinity,
    };
  };

  const defenseOf = (troops: TroopCounts): number => sideStats(data, { ...defender, troops }, true).strength;

  /** Déroule le plan ; `lookahead` = essayer chaque crash possible (sinon : meilleur ratio direct). */
  const run = (remaining: readonly number[], troops: TroopCounts, lookahead: boolean): RazPass[] => {
    const passes: RazPass[] = [];
    let rest = [...remaining];
    while (rest.length && !isEmpty(troops)) {
      const defense = defenseOf(troops);
      const winners = rest.filter((i) => strength[i] > defense);
      let pass: RazPass;
      if (winners.length) {
        pass = fight(winners.reduce((best, i) => (strength[i] > strength[best] ? i : best)), troops);
      } else {
        const options = rest.map((i) => {
          const crash = fight(i, troops);
          const then = lookahead ? run(rest.filter((j) => j !== i), crash.defenderAfter, false) : [];
          return { crash, wins: then.filter((p) => !p.crash).length };
        });
        options.sort((a, b) => b.wins - a.wins || a.crash.lossRatio - b.crash.lossRatio);
        pass = options[0].crash;
      }
      passes.push(pass);
      troops = pass.defenderAfter;
      rest = rest.filter((i) => i !== pass.attacker);
    }
    return passes;
  };

  const fighters = attackers.flatMap((_, i) => (strength[i] > 0 ? [i] : []));
  const passes = run(fighters, defender.troops, true);
  const used = new Set(passes.map((p) => p.attacker));
  return {
    passes,
    unused: fighters.filter((i) => !used.has(i)),
    empty,
    wins: passes.filter((p) => !p.crash).length,
    crashes: passes.filter((p) => p.crash).length,
    defenderRemaining: passes.at(-1)?.defenderAfter ?? defender.troops,
  };
}
