import { planPlunder, plunderCapacity, storageCapacity } from './plunder.logic';

describe('storageCapacity', () => {
  it('vise le plus petit des deux dépôts', () => {
    // Dépôt de ressources 8 : 6 283 ; Dépôt de nourriture 4 : 2 400.
    expect(storageCapacity(8, 4)).toEqual({ resources: 6283, food: 2400, target: 2400 });
  });
});

describe('planPlunder', () => {
  it('remplit exactement quand c’est possible, sans dépasser', () => {
    const plan = planPlunder({ genin: 1000, chunin: 0, jounin: 0 }, 1300);
    expect(plan.team).toEqual({ genin: 100, chunin: 0, jounin: 0 });
    expect(plan.capacity).toBe(1300);
    expect(plan.teams).toBe(10);
    expect(plan.leftover).toEqual({ genin: 0, chunin: 0, jounin: 0 });
  });

  it('ne dépasse jamais la cible', () => {
    const army = { genin: 693, chunin: 414, jounin: 53 };
    for (const target of [100, 999, 4098, 6283]) {
      const plan = planPlunder(army, target);
      expect(plan.capacity).toBeLessThanOrEqual(target);
      expect(plunderCapacity(plan.team)).toBe(plan.capacity);
    }
  });

  it('prend toute l’armée quand elle ne suffit pas à remplir les dépôts', () => {
    const plan = planPlunder({ genin: 10, chunin: 5, jounin: 1 }, 100_000);
    expect(plan.team).toEqual({ genin: 10, chunin: 5, jounin: 1 });
    expect(plan.capacity).toBe(10 * 13 + 5 * 26 + 53);
    expect(plan.teams).toBe(1);
  });

  it('à pillage égal, privilégie la composition qui forme le plus d’équipes', () => {
    // 26 de pillage : 2 Genin (5 équipes) ou 1 Chunin (1 équipe).
    const plan = planPlunder({ genin: 10, chunin: 1, jounin: 0 }, 26);
    expect(plan.team).toEqual({ genin: 2, chunin: 0, jounin: 0 });
    expect(plan.teams).toBe(5);
  });

  it('ne forme aucune équipe sans troupes', () => {
    expect(planPlunder({ genin: 0, chunin: 0, jounin: 0 }, 5000).teams).toBe(0);
  });
});
