import { FOOD_DEPOT_LEVELS, RESOURCE_DEPOT_LEVELS } from '../buildings/buildings.data';
import { BUILDING_GUIDES } from '../buildings/buildings.guides';
import { parseDuration, simulateUpgrades, SimulationInput } from './simulation.logic';

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
    const plan = simulateUpgrades({ ...base, buildingId: 'jounin', currentLevel: 0, targetLevel: 1, resourceDepotLevel: 1, foodDepotLevel: 1 });
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

  it("signale un niveau visé au-delà du maximum", () => {
    const plan = simulateUpgrades({ ...base, currentLevel: 19, targetLevel: 21 });
    expect(plan.steps).toHaveLength(1);
    expect(plan.blocker).toContain('niveau maximum');
  });
});
