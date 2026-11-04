import { planFullTeams, planPlunder, plunderCapacity, storageCapacity } from './plunder.logic';

describe('storageCapacity', () => {
  it('vise le plus petit des deux dépôts', () => {
    // Dépôt de ressources 8 : 6 283 ; Dépôt de nourriture 4 : 2 400.
    expect(storageCapacity(8, 4)).toEqual({ resources: 6283, food: 2400, target: 2400 });
  });
});

describe('planPlunder', () => {
  const sum = (plan: ReturnType<typeof planPlunder>, id: 'genin' | 'chunin' | 'jounin') =>
    plan.groups.reduce((n, g) => n + g.team[id] * g.count, 0);

  it('remplit exactement quand c’est possible', () => {
    const plan = planPlunder({ genin: 1000, chunin: 0, jounin: 0 }, 1300);
    expect(plan.groups).toEqual([{ team: { genin: 100, chunin: 0, jounin: 0 }, capacity: 1300, count: 10 }]);
    expect(plan.teams).toBe(10);
  });

  it('utilise toute l’armée, sans dépasser la cible, avec le moins d’équipes possible', () => {
    const army = { genin: 693, chunin: 414, jounin: 53 };
    for (const target of [999, 4098, 6283]) {
      const plan = planPlunder(army, target);
      expect(sum(plan, 'genin')).toBe(693);
      expect(sum(plan, 'chunin')).toBe(414);
      expect(sum(plan, 'jounin')).toBe(53);
      expect(plan.groups.every((g) => g.capacity <= target && plunderCapacity(g.team) === g.capacity)).toBe(true);
      expect(plan.teams).toBeLessThanOrEqual(Math.ceil(plan.total / target) + 1);
    }
  });

  it('répartit en équipes équilibrées qui ne remplissent pas forcément les dépôts', () => {
    // 1 050 Genin = 13 650 de pillage pour une cible de 6 283 : 3 équipes de 350 (4 550 chacune).
    const plan = planPlunder({ genin: 1050, chunin: 0, jounin: 0 }, 6283);
    expect(plan.groups).toEqual([{ team: { genin: 350, chunin: 0, jounin: 0 }, capacity: 4550, count: 3 }]);
  });

  it('envoie une seule équipe quand l’armée ne remplit pas les dépôts', () => {
    const plan = planPlunder({ genin: 10, chunin: 5, jounin: 1 }, 100_000);
    expect(plan.groups).toEqual([{ team: { genin: 10, chunin: 5, jounin: 1 }, capacity: 10 * 13 + 5 * 26 + 53, count: 1 }]);
  });

  it('ne forme aucune équipe sans troupes', () => {
    expect(planPlunder({ genin: 0, chunin: 0, jounin: 0 }, 5000).teams).toBe(0);
  });
});

describe('planFullTeams', () => {
  it('remplit exactement quand c’est possible, sans reste', () => {
    expect(planFullTeams({ genin: 1000, chunin: 0, jounin: 0 }, 1300)).toEqual({
      team: { genin: 100, chunin: 0, jounin: 0 },
      capacity: 1300,
      teams: 10,
      leftover: { genin: 0, chunin: 0, jounin: 0 },
    });
  });

  it('ne dépasse jamais la cible, et le reste complète l’armée', () => {
    const army = { genin: 693, chunin: 414, jounin: 53 };
    for (const target of [100, 999, 4098, 6283]) {
      const plan = planFullTeams(army, target);
      expect(plan.capacity).toBeLessThanOrEqual(target);
      expect(plunderCapacity(plan.team)).toBe(plan.capacity);
      for (const id of ['genin', 'chunin', 'jounin'] as const) expect(plan.team[id] * plan.teams + plan.leftover[id]).toBe(army[id]);
    }
  });

  it('prend toute l’armée quand elle ne suffit pas à remplir les dépôts', () => {
    const plan = planFullTeams({ genin: 10, chunin: 5, jounin: 1 }, 100_000);
    expect([plan.team, plan.teams]).toEqual([{ genin: 10, chunin: 5, jounin: 1 }, 1]);
  });

  it('à pillage égal, privilégie la composition qui forme le plus d’équipes', () => {
    const plan = planFullTeams({ genin: 10, chunin: 1, jounin: 0 }, 26);
    expect([plan.team, plan.teams]).toEqual([{ genin: 2, chunin: 0, jounin: 0 }, 5]);
  });

  it('ne forme aucune équipe sans troupes', () => {
    expect(planFullTeams({ genin: 0, chunin: 0, jounin: 0 }, 5000).teams).toBe(0);
  });
});
