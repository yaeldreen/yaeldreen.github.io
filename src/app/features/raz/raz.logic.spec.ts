import { Army } from '../combat/combat.logic';
import { planRaz } from './raz.logic';

const levels = { training: 0, academy: 0, chunnin: 0, jounin: 0, wall: 0, hospital: 0 };
const army = (genin: number, chuunin = 0, jounin = 0): Army => ({
  troops: { genin, chuunin, jounin },
  levels,
  hospitalTicket: false,
  combatTicket: false,
});

describe('planRaz', () => {
  it('fait passer les plus forts d’abord quand tous peuvent gagner', () => {
    const plan = planRaz([army(150), army(400), army(250)], army(100));
    expect(plan.passes.map((p) => p.attacker)).toEqual([1, 2, 0]);
    expect(plan.crashes).toBe(0);
    expect(plan.passes[1].defenderBefore.genin).toBe(50);
  });

  it('envoie un crash quand personne ne peut gagner, puis fait passer les autres', () => {
    // Défense 1000 : personne ne gagne. Faire crasher 900 (−20,7 %) laisse 793, que 800 bat ; crasher 800 laisse 816,
    // que 900 bat. Une victoire dans les deux cas : 900 crashe car son ratio pertes / tués est meilleur (1,2 contre 1,5).
    const plan = planRaz([army(900), army(800), army(300)], army(1000));
    expect(plan.passes[0]).toMatchObject({ attacker: 0, crash: true });
    expect(plan.passes[1]).toMatchObject({ attacker: 1, crash: false });
    expect(plan.wins).toBe(1);
  });

  it('choisit pour le crash le meilleur ratio pertes / tués à nombre de victoires égal', () => {
    // Défense 1000 : 600 perd 61 % pour 138 tués (ratio 2,7), 200 perd tout pour 46 tués (ratio 4,3).
    const plan = planRaz([army(200), army(600)], army(1000));
    expect(plan.wins).toBe(0);
    expect(plan.passes[0].attacker).toBe(1);
  });

  it('ignore les attaquants vides et s’arrête quand la défense est vide', () => {
    const plan = planRaz([army(0), army(500), army(500)], army(1));
    expect(plan.empty).toEqual([0]);
    expect(plan.passes).toHaveLength(1);
    expect(plan.unused).toEqual([2]);
  });

  it('ne remet jamais les soignés du défenseur pendant le raz', () => {
    const defender = { ...army(100), levels: { ...levels, hospital: 20 } };
    const plan = planRaz([army(500)], defender);
    expect(plan.passes[0].defenderAfter.genin).toBe(50);
  });
});
