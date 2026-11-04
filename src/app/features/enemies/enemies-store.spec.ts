import { MapVillage } from '../../core/game-data/map-villages';
import { armyRecords, importedVillage, uniqueVillages } from './enemies-store';

const village = (name: string, points: number, neutral?: boolean): MapVillage => ({ name, kage: 'Naruto sun', x: 1, y: 2, clan: 'Tsukuyomi', points, inhabitants: 3, neutral: neutral as boolean });

describe('uniqueVillages', () => {
  it('garde le document mis à jour par les imports, quel que soit l’ordre', () => {
    const raw = { id: 'Lisiere city', data: village('Lisiere city', 1) };
    const main = { id: 'lisiere%20city', data: village('Lisiere city', 2) };
    expect(uniqueVillages([raw, main]).map((v) => v.points)).toEqual([2]);
    expect(uniqueVillages([main, raw]).map((v) => v.points)).toEqual([2]);
  });

  it('compte un ancien document sans `neutral` comme village de joueur', () => {
    expect(uniqueVillages([{ id: 'x', data: village('X', 1) }])[0].neutral).toBe(false);
  });
});

describe('armées dans les villages', () => {
  const army = { troops: { genin: 1, chuunin: 2, jounin: 3 }, side: null, updatedAt: '2026-11-04' };
  const base = (kage: string, extra: Partial<MapVillage> = {}): MapVillage => ({ name: 'A', kage, x: 1, y: 2, clan: 'Palace', points: 0, inhabitants: 0, neutral: false, ...extra });

  it('indexe les armées par joueur', () => {
    expect(armyRecords([base('Bob', { army }), base('Sans armée')])).toEqual({ bob: { player: 'Bob', ...army } });
  });

  it('un import conserve l’armée et les notes, même si le joueur est renommé', () => {
    expect(importedVillage(base('Nouveau'), base('Ancien', { army, ce: 12 }))).toEqual(base('Nouveau', { army, ce: 12 }));
  });

  it('un import retire l’armée d’un membre de notre clan', () => {
    const record = importedVillage(base('Bob', { clan: 'Tsukuyomi' }), base('Bob', { army, ce: 12 }));
    expect(record).toEqual(base('Bob', { clan: 'Tsukuyomi', ce: 12 }));
  });
});
