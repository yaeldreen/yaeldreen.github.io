import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { Buildings, fieldsFor, findBuilding, levelField, levelFieldPages, parseAnswer, prerequisitesLine, suggestValue, TreeEntry, withLevel } from './buildings.js';

const data = JSON.parse(readFileSync(new URL('../../../data/game-data.json', import.meta.url), 'utf8')) as {
  buildings: Buildings;
  tree: { buildings: TreeEntry[] };
};
const { buildings } = data;

describe('build guide', () => {
  it('retrouve un bâtiment par nom, clé ou alias, sans accents', () => {
    for (const q of ['Académie', 'academie', 'academy', 'acad']) {
      assert.equal((findBuilding(buildings, q) as { key: string }).key, 'academy');
    }
    assert.deepEqual((findBuilding(buildings, 'hopital') as { key: string }).key, 'hospital');
    assert.deepEqual((findBuilding(buildings, 'CE') as { key: string }).key, 'training');
    assert.deepEqual((findBuilding(buildings, 'mur d’enceinte') as { key: string }).key, 'wall');
  });

  it('propose des candidats quand le nom est ambigu', () => {
    const r = findBuilding(buildings, 'centre');
    assert.ok('candidates' in r && r.candidates.length > 1);
  });

  it('pose les questions propres au bâtiment', () => {
    const keys = (k: string) => fieldsFor(buildings[k]).map((f) => f.key);
    assert.deepEqual(keys('hq'), ['level', 'buildTime', 'population', 'stone', 'wood', 'iron', 'food']);
    assert.ok(keys('hospital').includes('troopRecovery'));
    assert.ok(keys('resourceDepot').includes('capacity'));
    assert.ok(!keys('resourceDepot').includes('power'));
  });

  it('lit les réponses', () => {
    const [level, time, , stone] = fieldsFor(buildings['hq']);
    assert.deepEqual(parseAnswer(stone, '1 234'), { value: 1234 });
    assert.deepEqual(parseAnswer(level, '21'), { value: 21 });
    assert.ok('error' in parseAnswer(level, '2,5'));
    assert.ok('error' in parseAnswer(stone, 'beaucoup'));
    assert.deepEqual(parseAnswer(time, ' 2 h 12 min '), { value: '2 h 12 min' });
  });

  it('remplace un niveau existant et garde l’ordre', () => {
    const levels = withLevel(buildings['raptor'].levels, { ...buildings['raptor'].levels[0], level: 3, stone: 1 });
    assert.deepEqual(levels.map((l) => l.level), [1, 2, 3, 4, 5]);
    assert.equal(levels[2].stone, 1);
  });

  it('affiche un niveau en lignes courtes, avec les effets du bâtiment', () => {
    const academy8 = levelField(buildings['academy'].levels[7]);
    assert.equal(academy8.name, 'Niveau 8  ·  ⏱️ 2 h 12 min');
    assert.equal(academy8.value, '🪨 4 100  🪵 3 210  ⚙️ 4 100  🍖 3 210\n👥 4 hab.  ·  ⚔️ Puissance +18 %');
    assert.match(levelField(buildings['watchtower'].levels[0]).value, /\nℹ️ 1 armée en approche visible/);
  });

  it('regroupe les fiches sous les limites d’un message Discord', () => {
    for (const b of Object.values(buildings)) {
      const pages = levelFieldPages(b.levels);
      assert.equal(pages.flat().length, b.levels.length, b.name);
      for (const page of pages) {
        assert.ok(page.length <= 25);
        assert.ok(page.reduce((n, f) => n + f.name.length + f.value.length, 0) <= 5000);
        assert.ok(page.every((f) => f.name.length <= 256 && f.value.length <= 1024));
      }
    }
  });

  it('propose la valeur d’un effet en prolongeant les niveaux voisins', () => {
    const academy = buildings['academy'].levels.filter((l) => l.level !== 13);
    assert.equal(suggestValue(academy, 'power', 13), 48);
    assert.equal(suggestValue(buildings['hq'].levels, 'power', 3), null);
  });

  it('donne les prérequis', () => {
    assert.equal(prerequisitesLine(data.tree.buildings, buildings['academy']), 'Prérequis : Quartier général niv. 3, Camp d’entraînement niv. 1');
  });
});
