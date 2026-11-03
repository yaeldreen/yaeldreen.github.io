import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { age, clanLines, playerCard, sectionLine, splitComment, survivors, toPlayerLevels } from './format.js';

const now = Date.parse('2026-11-04T12:00:00Z');
const pacers = { name: 'Pacers', village: 'Malice at the pa', clan: 'Maelström', points: 7211, inhabitants: 336, ce: 6, wall: 3 };

describe('infos ennemis', () => {
  it('calcule les troupes restantes d’un rapport', () => {
    assert.deepEqual(survivors({ genin: 2323, chuunin: 1396, jounin: 282 }, { genin: 567, chuunin: 341, jounin: 69 }), { genin: 1756, chuunin: 1055, jounin: 213 });
    assert.equal(survivors({ genin: 100, chuunin: null, jounin: 0 }, { genin: 0, chuunin: 0, jounin: 0 }), null);
  });

  it('donne l’ancienneté d’une armée', () => {
    assert.equal(age('2026-11-04T11:30:00Z', now), 'il y a 30 min');
    assert.equal(age('2026-11-04T07:00:00Z', now), 'il y a 5 h');
    assert.equal(age('2026-11-01T12:00:00Z', now), 'il y a 3 j');
  });

  it('fait la fiche d’un joueur', () => {
    const card = playerCard(
      pacers,
      { name: 'Malice at the pa', kage: 'Pacers', x: 8191, y: 12, clan: 'Maelström', neutral: false },
      { player: 'Pacers', troops: { genin: 1756, chuunin: 1055, jounin: 213 }, side: 'Défenseur', updatedAt: '2026-11-04T07:00:00Z' },
      { name: 'Pacers', clan: 'Maelström', points: 7211, previousPoints: 6850, pointsDelta: 361, inhabitants: 336, previousInhabitants: 336, inhabitantsDelta: 0 },
      now,
    );
    assert.match(card, /📍 8191 \/ 12/);
    assert.match(card, /7 211 pts \(\+361 sur le mois\)/);
    assert.match(card, /336 hab\. \(±0 sur le mois\)/);
    assert.match(card, /CE 6 · Acad \? .* 🧱 3/);
    assert.match(card, /⚔️ 1 756 \/ 1 055 \/ 213 \(il y a 5 h, défenseur\)/);
  });

  it('liste un clan, les plus gros d’abord', () => {
    const lines = clanLines([{ ...pacers, points: 100 }, pacers], new Map(), (n) => n);
    assert.match(lines[0], /7 211 pts/);
  });

  it('récapitule une section de rapport', () => {
    assert.match(sectionLine('Défenseur', 'Pacers', { genin: 10, chuunin: 5, jounin: 1 }, { genin: 2, chuunin: 0, jounin: 0 }, { genin: 8, chuunin: 5, jounin: 1 }), /restants \*\*8 \/ 5 \/ 1\*\*/);
  });

  it('range les niveaux saisis dans les champs de la base', () => {
    assert.deepEqual(toPlayerLevels({ ce: 12, chunnin: 8, wall: 7 }), { ce: 12, chunninCenter: 8, wall: 7 });
  });
});

describe('commentaire sur un joueur', () => {
  it('sépare le joueur du texte au premier « : »', () => {
    assert.deepEqual(splitComment('Malice at the pa : attaque la nuit, gros mur'), { player: 'Malice at the pa', text: 'attaque la nuit, gros mur' });
    assert.deepEqual(splitComment('Konan: horaires: 6h-8h'), { player: 'Konan', text: 'horaires: 6h-8h' });
    assert.deepEqual(splitComment('Konan :'), { player: 'Konan', text: '' });
    assert.equal(splitComment('Konan'), null);
  });

  it('s’affiche dans la fiche, avec auteur et ancienneté', () => {
    const card = playerCard({ ...pacers, comment: 'Gros mur', commentBy: 'Nico', commentAt: '2026-11-04T07:00:00Z' }, null, undefined, undefined, now);
    assert.match(card, /💬 Gros mur\n_Nico, il y a 5 h_/);
  });
});
