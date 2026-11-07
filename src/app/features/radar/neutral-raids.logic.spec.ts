import { newRaids, NeutralRaid, parseRaidsExport, raidedVillages, raidId, raidTime, sortedRaids } from './neutral-raids.logic';

const raid = (village: number, at: string, attacker = 'Kibutsuji', attackerVillageId = 12): NeutralRaid => ({
  village,
  villageName: 'Natsugawa',
  attacker,
  attackerVillageId,
  mode: 'pillage',
  at,
});

describe('parseRaidsExport', () => {
  const event = { attacker: 'Boboch', attackerVillageId: 146, target: 'Fuyukawa', targetVillageId: -70, mode: 'pillage', createdAt: 1794060720000 };

  it('lit l’historique collé, date en millisecondes ou ISO', () => {
    const text = JSON.stringify([event, { ...event, attacker: 'SENJU', mode: 'combat', createdAt: '2026-11-07T13:01:00Z' }]);
    expect(parseRaidsExport(text)).toEqual({
      raids: [
        { village: -70, villageName: 'Fuyukawa', attacker: 'Boboch', attackerVillageId: 146, mode: 'pillage', at: new Date(1794060720000).toISOString() },
        { village: -70, villageName: 'Fuyukawa', attacker: 'SENJU', attackerVillageId: 146, mode: 'attaque', at: '2026-11-07T13:01:00.000Z' },
      ],
      ignored: 0,
    });
  });

  it('écarte les attaques sur un village de joueur', () => {
    expect(parseRaidsExport(JSON.stringify([event, { ...event, targetVillageId: 80 }]))).toMatchObject({ ignored: 1, raids: [{ village: -70 }] });
  });

  it('explique ce qui ne va pas', () => {
    expect(() => parseRaidsExport('[{')).toThrow('JSON valide');
    expect(() => parseRaidsExport('{"a":1}')).toThrow('liste d');
    expect(() => parseRaidsExport(JSON.stringify([event, { attacker: 'X' }]))).toThrow('Attaque n°2');
  });
});

describe('newRaids', () => {
  it('écarte les attaques déjà en base et les doublons du relevé', () => {
    const a = raid(-68, '2026-11-07T13:04:00.000Z');
    const b = raid(-68, '2026-11-07T13:01:00.000Z', 'SENJU', 34);
    expect(newRaids([a, b, { ...b }], new Set([raidId(a)]))).toEqual([b]);
  });

  it('distingue deux attaques à la même heure par l’attaquant', () => {
    expect(raidId(raid(-68, '2026-11-07T13:04:00.000Z'))).not.toBe(raidId(raid(-68, '2026-11-07T13:04:00.000Z', 'Autre', 99)));
  });
});

describe('tableau des attaques', () => {
  const raids = [raid(-2, '2026-11-05T10:00:00.000Z'), raid(-3, '2026-11-07T10:00:00.000Z', 'B'), raid(-3, '2026-11-06T10:00:00.000Z'), raid(-3, '2026-11-07T10:00:00.000Z', 'A')];

  it('trie de la plus récente à la plus ancienne, à égalité par attaquant', () => {
    expect(sortedRaids(raids).map((r) => [r.at.slice(0, 10), r.attacker])).toEqual([
      ['2026-11-07', 'A'],
      ['2026-11-07', 'B'],
      ['2026-11-06', 'Kibutsuji'],
      ['2026-11-05', 'Kibutsuji'],
    ]);
  });

  it('filtre sur un village', () => {
    expect(sortedRaids(raids, -2)).toHaveLength(1);
    expect(sortedRaids(raids, -3).every((r) => r.village === -3)).toBe(true);
  });

  it('propose les villages attaqués, par nom', () => {
    const named = [{ ...raid(-1, '2026-11-07T10:00:00Z'), villageName: 'Zeta' }, { ...raid(-2, '2026-11-07T10:00:00Z'), villageName: 'Akano' }, { ...raid(-2, '2026-11-07T11:00:00Z'), villageName: 'Akano' }];
    expect(raidedVillages(named)).toEqual([
      { id: -2, name: 'Akano' },
      { id: -1, name: 'Zeta' },
    ]);
  });

  it('affiche la date et l’heure de Paris', () => {
    expect(raidTime('2026-11-07T13:04:00.000Z')).toBe('07/11/2026 14:04');
  });
});
