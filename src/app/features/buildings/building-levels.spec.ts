import { EFFECT_FIELDS, levelEntries, levelForm, LevelRow, readLevelForm, upsertLevel } from './building-levels';

const row: LevelRow = { level: 5, buildTime: '29 min', population: 2, stone: 1977, wood: 1830, iron: 1310, food: 910, troopRecovery: 14 };
const hospital = EFFECT_FIELDS.hospital!;

describe('levelEntries', () => {
  it('signale chaque niveau manquant de 1 à 20', () => {
    const entries = levelEntries([{ level: 1 }, { level: 2 }, { level: 4 }]);
    expect(entries.length).toBe(20);
    expect(entries.filter((e) => !e.row).map((e) => e.level)).toEqual([3, ...Array.from({ length: 16 }, (_, i) => i + 5)]);
  });

  it('garde un niveau hors de 1 à 20 (mine niveau 0)', () => {
    expect(levelEntries([{ level: 0 }])[0]).toEqual({ level: 0, row: { level: 0 } });
  });
});

describe('upsertLevel', () => {
  it('insère un niveau à sa place et remplace un niveau existant', () => {
    expect(upsertLevel([{ level: 1 }, { level: 6 }], { level: 5 }).map((l) => l.level)).toEqual([1, 5, 6]);
    expect(upsertLevel([{ level: 5, a: 1 }], { level: 5, a: 2 })).toEqual([{ level: 5, a: 2 }]);
  });
});

describe('formulaire de niveau', () => {
  it('préremplit puis relit un niveau existant sans le changer', () => {
    const result = readLevelForm(5, levelForm(row, hospital), hospital);
    expect(result).toEqual({ row });
  });

  it('accepte un effet à virgule et un commentaire', () => {
    const form = levelForm({ ...row, comment: 'Tout voir' }, EFFECT_FIELDS.watchtower!);
    expect(readLevelForm(5, form, EFFECT_FIELDS.watchtower!)).toMatchObject({ row: { comment: 'Tout voir' } });
    const decimal = levelForm({ ...row, troopRecovery: 14.5 }, hospital);
    expect(readLevelForm(5, decimal, hospital)).toMatchObject({ row: { troopRecovery: 14.5 } });
  });

  it('refuse un formulaire vide, un temps illisible ou une ressource invalide', () => {
    expect(readLevelForm(5, levelForm(undefined, []), [])).toEqual({ error: 'Renseignez le temps de construction.' });
    const form = levelForm(row, hospital);
    expect(readLevelForm(5, { ...form, buildTime: 'bientôt' }, hospital)).toMatchObject({ error: expect.stringContaining('illisible') });
    expect(readLevelForm(5, { ...form, numbers: { ...form.numbers, stone: 1.5 } }, hospital)).toMatchObject({ error: expect.stringContaining('entiers') });
    expect(readLevelForm(5, { ...form, numbers: { ...form.numbers, troopRecovery: null } }, hospital)).toMatchObject({ error: expect.stringContaining('Récupération') });
  });
});
