import { emptySide } from '../combat/army-form';
import { decodeRazHistory, encodeRazHistory, pushRazHistory, RazEntry } from './raz-history';

const side = (player: string, genin: number) => ({ player, form: { ...emptySide(), troops: { genin, chuunin: 2000, jounin: 400 } } });
const entry = (at: number, attackers = 3): RazEntry => ({
  at,
  defender: side('Malice at the pa', 2323),
  attackers: Array.from({ length: attackers }, (_, i) => side(`Attaquant ${i}`, 1000 + i)),
  healedReturn: true,
});

describe('historique de raz', () => {
  it('se relit à l’identique', () => {
    const list = [entry(2), entry(1)];
    expect(decodeRazHistory(encodeRazHistory(list))).toEqual(list);
  });

  it('garde les 2 derniers', () => {
    const list = [3, 4, 5].reduce<RazEntry[]>((h, at) => pushRazHistory(h, entry(at, at)), []);
    expect(list.map((e) => e.at)).toEqual([5, 4]);
  });

  it('remonte un raz relancé sans le dupliquer', () => {
    expect(pushRazHistory([entry(2), entry(1, 4)], entry(3, 4)).map((e) => e.at)).toEqual([3, 2]);
  });

  it('abandonne le plus ancien quand le cookie déborderait', () => {
    const list = pushRazHistory([entry(1, 25)], entry(2, 25));
    expect(list.map((e) => e.at)).toEqual([2]);
  });

  it('ignore un cookie illisible', () => {
    expect(decodeRazHistory('[oops')).toEqual([]);
  });
});
