import { decodeHistory, encodeHistory, HistoryEntry, pushHistory } from './combat-history';

const entry = (at: number, genin: number | null = 100): HistoryEntry => ({
  at,
  attacker: {
    player: 'Tard',
    form: {
      troops: { genin, chuunin: 50, jounin: null },
      levels: { training: 11, academy: 8, chunnin: 8, jounin: 1, hospital: null, wall: null },
      hospitalTicket: false,
      combatTicket: true,
    },
  },
  defender: {
    player: '',
    form: {
      troops: { genin: 10, chuunin: 0, jounin: 0 },
      levels: { training: null, academy: null, chunnin: null, jounin: null, hospital: 3, wall: 5 },
      hospitalTicket: true,
      combatTicket: false,
    },
  },
});

describe('historique de combat', () => {
  it('se relit à l’identique', () => {
    const list = [entry(2), entry(1, 7)];
    expect(decodeHistory(encodeHistory(list))).toEqual(list);
  });

  it('garde les 5 plus récentes, sans doublon', () => {
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 7; i++) list = pushHistory(list, entry(i, i));
    expect(list.map((e) => e.at)).toEqual([6, 5, 4, 3, 2]);
    expect(pushHistory(list, entry(9, 4)).map((e) => e.at)).toEqual([9, 6, 5, 3, 2]);
  });

  it('tient dans un cookie', () => {
    const list = Array.from({ length: 5 }, (_, i) => entry(Date.now() + i, 123456));
    expect(encodeURIComponent(encodeHistory(list)).length).toBeLessThan(3500);
  });

  it('ignore un cookie illisible', () => {
    expect(decodeHistory('{oops')).toEqual([]);
    expect(decodeHistory(null)).toEqual([]);
  });
});
