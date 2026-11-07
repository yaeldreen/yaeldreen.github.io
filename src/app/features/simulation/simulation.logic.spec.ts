import { FOOD_DEPOT_LEVELS, RESOURCE_DEPOT_LEVELS } from '../buildings/buildings.data';
import { BUILDING_GUIDES } from '../buildings/buildings.guides';
import { parseDuration, prerequisiteFields, simulateUpgrades, SimulationInput } from './simulation.logic';

describe('parseDuration', () => {
  it('lit tous les formats des tableaux', () => {
    expect(parseDuration('0:00:03:20')).toBe(200);
    expect(parseDuration('1min 47s')).toBe(107);
    expect(parseDuration('1 j 4 h 50 min')).toBe(86400 + 4 * 3600 + 50 * 60);
    expect(parseDuration('55 sec')).toBe(55);
    expect(parseDuration('18 secondes')).toBe(18);
    expect(parseDuration('0')).toBe(0);
  });

  it('accepte chaque temps de construction de chaque bâtiment', () => {
    for (const guide of BUILDING_GUIDES) {
      for (const row of guide.rows) expect(() => parseDuration(row.buildTime), `${guide.label} niv. ${row.level}`).not.toThrow();
    }
  });

  it('refuse un texte inconnu', () => {
    expect(() => parseDuration('2 semaines')).toThrow();
  });
});

describe('simulateUpgrades', () => {
  const base: SimulationInput = { buildingId: 'hq', currentLevel: 1, targetLevel: 2, resourceDepotLevel: 20, foodDepotLevel: 20 };

  it("n'ajoute aucun dépôt quand la capacité suffit", () => {
    const plan = simulateUpgrades(base);
    expect(plan.steps.map((s) => [s.buildingId, s.level])).toEqual([['hq', 2]]);
    expect(plan.totalSeconds).toBe(200);
    expect(plan.storageSeconds).toBe(0);
  });

  it('monte les dépôts au niveau juste suffisant, puis construit', () => {
    // Jounin niv. 1 : pierre 7 000 → Dépôt de ressources niv. 9 (7 829) ; nourriture 5 200 → Dépôt de nourriture niv. 8 (6 283).
    const plan = simulateUpgrades({ ...base, buildingId: 'jounin', currentLevel: 0, targetLevel: 1, resourceDepotLevel: 1, foodDepotLevel: 1, levels: { hq: 12, chunnin: 5 } });
    const last = (id: string) => Math.max(...plan.steps.filter((s) => s.buildingId === id).map((s) => s.level));
    expect(last('resourceDepot')).toBe(9);
    expect(last('foodDepot')).toBe(8);
    expect(plan.steps.at(-1)).toMatchObject({ buildingId: 'jounin', level: 1, isStorage: false });
    expect(plan.blocker).toBeUndefined();
  });

  it('respecte la capacité des dépôts à chaque étape', () => {
    const input: SimulationInput = { ...base, buildingId: 'jounin', currentLevel: 0, targetLevel: 20, resourceDepotLevel: 1, foodDepotLevel: 1 };
    const plan = simulateUpgrades(input);
    let res = input.resourceDepotLevel;
    let food = input.foodDepotLevel;
    for (const step of plan.steps) {
      const resCap = RESOURCE_DEPOT_LEVELS[res - 1].capacity;
      const foodCap = FOOD_DEPOT_LEVELS[food - 1].capacity;
      expect(Math.max(step.row.stone, step.row.wood, step.row.iron)).toBeLessThanOrEqual(resCap);
      expect(step.row.food).toBeLessThanOrEqual(foodCap);
      if (step.buildingId === 'resourceDepot') res = step.level;
      if (step.buildingId === 'foodDepot') food = step.level;
    }
    expect(plan.steps.at(-1)?.level).toBe(20);
  });

  it('fait évoluer le dépôt choisi comme bâtiment cible avec ses propres améliorations', () => {
    const plan = simulateUpgrades({ ...base, buildingId: 'resourceDepot', currentLevel: 3, targetLevel: 5, resourceDepotLevel: 1 });
    expect(plan.steps.map((s) => s.level)).toEqual([4, 5]);
  });

  it('signale un niveau sans données (Commerce niv. 5)', () => {
    const plan = simulateUpgrades({ ...base, buildingId: 'commerce', currentLevel: 3, targetLevel: 7 });
    expect(plan.steps.map((s) => s.level)).toEqual([4]);
    expect(plan.blocker).toContain('niv. 5 non renseignés');
  });

  it("signale un niveau visé au-delà du maximum", () => {
    const plan = simulateUpgrades({ ...base, currentLevel: 19, targetLevel: 21 });
    expect(plan.steps).toHaveLength(1);
    expect(plan.blocker).toContain('niveau maximum');
  });

  describe('prérequis', () => {
    const empty: SimulationInput = { ...base, currentLevel: 0, targetLevel: 1, resourceDepotLevel: 20, foodDepotLevel: 20 };
    const built = (plan: ReturnType<typeof simulateUpgrades>) => plan.steps.map((s) => `${s.buildingId} ${s.level}`);

    it('construit les prérequis manquants avant le niveau 1', () => {
      const plan = simulateUpgrades({ ...empty, buildingId: 'academy', levels: { hq: 2 } });
      expect(built(plan)).toEqual(['hq 3', 'training 1', 'academy 1']);
      expect(plan.steps[0]).toMatchObject({ isPrerequisite: true, isStorage: false });
      expect(plan.steps[0].explanation).toContain('Prérequis de Académie');
      expect(plan.steps.at(-1)).toMatchObject({ isPrerequisite: false });
    });

    it('n’ajoute rien si les prérequis sont remplis, ou si le bâtiment existe déjà', () => {
      expect(built(simulateUpgrades({ ...empty, buildingId: 'academy', levels: { hq: 3, training: 1 } }))).toEqual(['academy 1']);
      expect(built(simulateUpgrades({ ...empty, buildingId: 'academy', currentLevel: 2, targetLevel: 3 }))).toEqual(['academy 3']);
    });

    it('remonte toute la chaîne depuis un village vide, chaque prérequis avant ce qui le demande', () => {
      const plan = simulateUpgrades({ ...empty, buildingId: 'watchtower' });
      const position = (step: string) => built(plan).indexOf(step);
      expect(plan.blocker).toBeUndefined();
      expect(position('hq 15')).toBeGreaterThanOrEqual(0);
      expect(position('training 1')).toBeLessThan(position('academy 1'));
      expect(position('academy 5')).toBeLessThan(position('chunnin 1'));
      expect(position('chunnin 5')).toBeLessThan(position('jounin 1'));
      expect(position('jounin 10')).toBeLessThan(position('watchtower 1'));
      expect(position('wall 8')).toBeLessThan(position('watchtower 1'));
      expect(built(plan).at(-1)).toBe('watchtower 1');
    });

    it('part d’un village sans rien, dépôts compris, sans boucler', () => {
      const plan = simulateUpgrades({ ...empty, buildingId: 'hospital', resourceDepotLevel: 0, foodDepotLevel: 0 });
      expect(plan.blocker).toBeUndefined();
      expect(built(plan)[0]).toBe('hq 1');
      expect(built(plan)).toContain('resourceDepot 1');
      expect(built(plan).at(-1)).toBe('hospital 1');
    });

    it('construit un dépôt à 0 quand il devient nécessaire, après le Quartier général', () => {
      const plan = simulateUpgrades({ ...empty, buildingId: 'wall', resourceDepotLevel: 0, foodDepotLevel: 20, levels: { hq: 0 } });
      expect(built(plan).indexOf('hq 1')).toBeLessThan(built(plan).indexOf('resourceDepot 1'));
      expect(built(plan).indexOf('resourceDepot 1')).toBeLessThan(built(plan).indexOf('wall 1'));
    });

    it('demande les prérequis du bâtiment à 0, et ceux des prérequis encore à 0', () => {
      const fields = (input: Partial<SimulationInput>) => prerequisiteFields({ ...empty, ...input }).map((f) => [f.buildingId, f.required]);
      expect(fields({ buildingId: 'chunnin' })).toEqual([['hq', 6], ['academy', 5], ['training', 1]]);
      expect(fields({ buildingId: 'chunnin', levels: { academy: 2 } })).toEqual([['hq', 6], ['academy', 5]]);
      expect(fields({ buildingId: 'chunnin', currentLevel: 1, targetLevel: 2 })).toEqual([]);
      expect(fields({ buildingId: 'hq' })).toEqual([]);
    });

    it('garde le niveau requis le plus élevé d’un bâtiment demandé plusieurs fois', () => {
      const hq = prerequisiteFields({ ...empty, buildingId: 'watchtower' }).find((f) => f.buildingId === 'hq');
      expect(hq?.required).toBe(15);
    });

    it('ne demande pas les dépôts, qui ont déjà leurs champs', () => {
      expect(prerequisiteFields({ ...empty, buildingId: 'resourceDepot' }).map((f) => f.buildingId)).toEqual(['hq']);
    });
  });
});
