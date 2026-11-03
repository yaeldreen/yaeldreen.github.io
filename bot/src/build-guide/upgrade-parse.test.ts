import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mostCommon, parseCostsLine, parseLevel } from './upgrade-parse.js';

// Lectures réelles de la capture « Coûts pour passer au niveau 13 » (seuils 170, 200, 220).
const AT_170 = 'Coûts pour passer au niveau 13 :\n140346° 12240., 9790 7830® 45. 1j10h23 min\nUn chantier de cette catégorie est déjà en cours.';
const AT_200 = 'Coûts pour passer au niveau 13 :\n14034»* 122400 : 9790 7830 * 4=.  1j10h23 min\nUn chantier de cette catégorie est déjà en cours.';
const AT_220 = '14034" " 12240 9790 7830 ° 4: 1j10 h 23 min\nUn chantier de cette catégorie est déjà en cours.';
const EXPECTED = { stone: 14034, wood: 12240, iron: 9790, food: 7830, population: 4, buildTime: '1 j 10 h 23 min' };

describe('lecture d’une capture de montée de niveau', () => {
  it('trouve le niveau visé', () => {
    assert.equal(parseLevel(AT_170), 13);
    assert.equal(parseLevel(AT_220), null);
  });

  it('lit la ligne des coûts quand les icônes sont bien écartées', () => {
    assert.deepEqual(parseCostsLine(AT_220), EXPECTED);
  });

  it('rejette une lecture douteuse (icône lue comme un chiffre)', () => {
    // 170 : « 140346 » et « 45 » sont faux mais il reste 5 nombres ; 200 : « 122400 ».
    assert.equal(parseCostsLine(AT_170), null);
    assert.notDeepEqual(parseCostsLine(AT_200), EXPECTED);
  });

  it('garde la lecture la plus fréquente', () => {
    assert.deepEqual(mostCommon([parseCostsLine(AT_170), parseCostsLine(AT_220), parseCostsLine(AT_200), parseCostsLine(AT_220)]), EXPECTED);
    assert.equal(mostCommon([null, null]), null);
  });

  it('rejette une durée impossible (« 1 j » lu « 17 », capture de téléphone)', () => {
    const at200 = 'Lots cul O0Sser ou n\'veau 18:\n14034" " 12240 . 9790 7830 ° 4= 1710 h 23 min';
    const at215 = '14034" " 12240 9790 7830 ° 4e 1j10 h 23 min';
    assert.equal(parseCostsLine(at200), null);
    assert.deepEqual(mostCommon([parseCostsLine(at200), parseCostsLine(at215)]), EXPECTED);
  });

  it('remet la durée en forme', () => {
    assert.equal(parseCostsLine('900 800 700 600 2 | 45 sec')?.buildTime, '45 s');
    assert.equal(parseCostsLine('900 800 700 600 2 | 2 h 12 min')?.buildTime, '2 h 12 min');
  });
});
