import { newRaids, NeutralRaid, nextRefreshAt, raidedVillages, raidId, raidsPageUrl, RAIDS_MESSAGE, raidTime, readRaidsMessage, sortedRaids } from './neutral-raids.logic';

const raid = (village: number, at: string, attacker = 'Kibutsuji', attackerVillageId = 12): NeutralRaid => ({
  village,
  villageName: 'Natsugawa',
  attacker,
  attackerVillageId,
  mode: 'pillage',
  at,
});

describe('readRaidsMessage', () => {
  it('lit l’historique de chaque village, date en millisecondes ou ISO', () => {
    const raids = readRaidsMessage({
      type: RAIDS_MESSAGE,
      villages: [
        {
          id: -68,
          name: 'Natsugawa',
          history: [
            { attacker: 'Kibutsuji', attackerVillageId: 12, mode: 'pillage', target: 'Natsugawa', createdAt: Date.parse('2026-11-07T13:04:00Z') },
            { attacker: 'SENJU', attackerVillageId: 34, mode: 'combat', target: 'Natsugawa', createdAt: '2026-11-07T13:01:00Z' },
          ],
        },
      ],
    });
    expect(raids).toEqual([
      { village: -68, villageName: 'Natsugawa', attacker: 'Kibutsuji', attackerVillageId: 12, mode: 'pillage', at: '2026-11-07T13:04:00.000Z' },
      { village: -68, villageName: 'Natsugawa', attacker: 'SENJU', attackerVillageId: 34, mode: 'attaque', at: '2026-11-07T13:01:00.000Z' },
    ]);
  });

  it('ignore les lignes illisibles, refuse un autre message', () => {
    const villages = [{ id: -1, name: 'A', history: [{ attacker: 'X' }, { attacker: 'Y', attackerVillageId: 1, createdAt: 'pas une date' }] }, { name: 'sans id', history: [] }];
    expect(readRaidsMessage({ type: RAIDS_MESSAGE, villages })).toEqual([]);
    expect(readRaidsMessage({ type: 'table-ronde:classement', villages })).toBeNull();
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

describe('actualisation', () => {
  it('ouvre la page du premier village avec tous les villages en ancre', () => {
    expect(raidsPageUrl([-68, -12])).toBe('https://worldofshinobi.com/joueur.html?id=-68#table-ronde-pillages=-68,-12');
  });

  it('n’est permise qu’une heure après la précédente', () => {
    const last = Date.parse('2026-11-07T13:00:00Z');
    expect(nextRefreshAt(null, last)).toBeNull();
    expect(nextRefreshAt(last, last + 59 * 60_000)).toBe(last + 3_600_000);
    expect(nextRefreshAt(last, last + 3_600_000)).toBeNull();
  });
});
