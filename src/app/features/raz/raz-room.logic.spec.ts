import { emptySide } from '../combat/army-form';
import { DEFENDER_KEY, emptyRoom, encodeRoom, Fighter, mergeRoom, newFighter } from './raz-room.logic';

const fighter = (id: number, player: string): Fighter => ({ id, player, loaded: null, form: emptySide() });
const local = (attackers: Fighter[]) => ({ defender: fighter(1, 'Moi'), attackers, simulated: false });

describe('mergeRoom', () => {
  it('prend le document partagé, attaquants triés par création', () => {
    const remote = { defender: fighter(1, 'Eux'), attackers: { '30': fighter(30, 'C'), '20': fighter(20, 'B') }, simulated: true };
    const merged = mergeRoom(remote, local([fighter(10, 'A')]), new Set());
    expect(merged.defender.player).toBe('Eux');
    expect(merged.attackers.map((a) => a.player)).toEqual(['B', 'C']);
    expect(merged.simulated).toBe(true);
  });

  it('garde la saisie en cours sans perdre ce que les autres ont changé', () => {
    const remote = { defender: fighter(1, 'Eux'), attackers: { '10': fighter(10, 'Ancien'), '20': fighter(20, 'Autre') } };
    const merged = mergeRoom(remote, local([fighter(10, 'Je tape')]), new Set([DEFENDER_KEY, '10']));
    expect(merged.defender.player).toBe('Moi');
    expect(merged.attackers.map((a) => a.player)).toEqual(['Je tape', 'Autre']);
  });

  it('retire un attaquant supprimé par quelqu’un d’autre', () => {
    const merged = mergeRoom({ attackers: { '20': fighter(20, 'B') } }, local([fighter(10, 'A'), fighter(20, 'B')]), new Set());
    expect(merged.attackers.map((a) => a.id)).toEqual([20]);
  });

  it('garde l’écran tant que la base est vide, et ignore un camp mal formé', () => {
    const screen = local([fighter(10, 'A')]);
    expect(mergeRoom(undefined, screen, new Set())).toEqual(screen);
    expect(mergeRoom({ defender: { id: 1 }, attackers: { '20': { player: 'B' } } }, screen, new Set())).toEqual(screen);
  });
});

describe('document partagé', () => {
  it('se relit à l’identique', () => {
    const room = emptyRoom();
    expect(mergeRoom(encodeRoom(room), emptyRoom(), new Set())).toEqual(room);
  });

  it('crée des identifiants uniques et croissants', () => {
    const ids = Array.from({ length: 50 }, () => newFighter().id);
    expect(ids).toEqual([...new Set(ids)].sort((a, b) => a - b));
  });
});
