import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parisToMs } from '../shared/paris-time.js';
import { looksLikeReportText, OcrWord, parseReport, parseReportText, parseReportTime } from './report-parser.js';

const paris = (year: number, month: number, day: number, hour = 0, minute = 0) => parisToMs({ year, month, day, hour, minute, second: 0 });

/** "texte@x" → mot OCR (y sans importance pour l'analyse). */
const line = (...words: string[]): OcrWord[] =>
  words.map((w) => {
    const [text, x] = w.split('@');
    return { text, x: Number(x), y: 0 };
  });

// Sortie réelle de Tesseract sur la capture d'exemple (rapport « Ninjas de Tard »).
const SAMPLE = [
  line('Assaillant@92', 'Ninjas@682', 'de@744', 'Tard@797'),
  line('Genin@376', 'Chuunin@734', 'Jounin@1092'),
  line('Ninjas@106', '500@376', '300@734', '100@1093'),
  line('Tués@105', '0@376', '0@734', '0@1092'),
  line('Pillage@103', '£”@230', '19600@309', '|@353', '“;,@387', '19600@456'),
];

describe('parseReport', () => {
  it('lit le rapport d’exemple', () => {
    assert.deepEqual(parseReport(SAMPLE), [
      {
        village: 'Tard',
        side: 'Assaillant',
        ninjas: { genin: 500, chuunin: 300, jounin: 100 },
        killed: { genin: 0, chuunin: 0, jounin: 0 },
      },
    ]);
  });

  it('recolle un nombre découpé par le séparateur de milliers et range par colonne', () => {
    const parsed = parseReport([
      line('Défenseur@90', 'Ninjas@600', 'de@660', 'Le@700', 'Sage@760'),
      line('Genin@376', 'Chuunin@734', 'Jounin@1092'),
      line('Ninjas@106', '1@360', '500@390', '300@734'), // pas de Jounin lu
      line('Tues@105', '12@376', 'O@734', '0@1092'),
    ]);
    assert.deepEqual(parsed, [
      {
        village: 'Le Sage',
        side: 'Défenseur',
        ninjas: { genin: 1500, chuunin: 300, jounin: null },
        killed: { genin: 12, chuunin: 0, jounin: 0 },
      },
    ]);
  });

  it('lit chaque section d’un rapport complet (sortie réelle de Tesseract)', () => {
    const parsed = parseReport([
      line('Rapport@110', 'de@220', 'l’attaque@337', '|@436', '22/10@502', 'à@574', '04h44@654'),
      line('Assaillant@124', 'Ninjas@754', 'de@830', 'Reggaeton@940'),
      line('Genin@448', 'Chuunin@864', 'Jounin@1280'),
      line('Ninjas@137', '969@448', '626@864', '105@1281'),
      line('Tués@136', '4@447', '2@864', '0@1280'),
      line('Pillage@137', 'Pierre@299', '1@358', '490@403', '|@444', 'Nourriture@869', 'O@957'),
      line('Points@81', 'gagnés@195', ':@265', '+38@306'),
      line('Défenseur@128', 'Ninjas@804', 'de@879', 'Tard@939'),
      line('Genin@448', 'Chuunin@864', 'Jounin@1280'),
      line('Ninjas@137', '16@449', '9@864', '3@1280'),
      line('Tués@136', '8@448', '4@863', '1@1279'),
      line('Points@81', 'gagnés@195', ':@265', '+14@307'),
    ]);
    assert.deepEqual(parsed, [
      {
        village: 'Reggaeton',
        side: 'Assaillant',
        ninjas: { genin: 969, chuunin: 626, jounin: 105 },
        killed: { genin: 4, chuunin: 2, jounin: 0 },
      },
      {
        village: 'Tard',
        side: 'Défenseur',
        ninjas: { genin: 16, chuunin: 9, jounin: 3 },
        killed: { genin: 8, chuunin: 4, jounin: 1 },
      },
    ]);
  });

  it('ne retourne rien sans rapport reconnaissable', () => {
    assert.deepEqual(parseReport([line('Bonjour@10', 'tout@50', 'le@80', 'monde@110')]), []);
  });
});

describe('parseReportTime', () => {
  const title = line('Rapport@110', 'de@220', 'l’attaque@337', '|@436', '25/10@502', 'à@574', '06h11@654');

  it('lit la date et l’heure du titre', () => {
    assert.equal(parseReportTime([title], paris(2026, 10, 25, 12)), paris(2026, 10, 25, 6, 11));
  });

  it('prend l’année précédente pour une date encore à venir', () => {
    assert.equal(parseReportTime([title], paris(2027, 1, 2)), paris(2026, 10, 25, 6, 11));
  });

  it('retourne null sans titre lisible', () => {
    assert.equal(parseReportTime([line('Ninjas@106', '500@376')]), null);
  });
});

describe('parseReportText', () => {
  const TEXT = `Rapport de l’attaque | 28/10 à 06h30
Heure française

Assaillant — Ninjas de Dragnir-City
Genin | Chuunin | Jounin
Ninjas : 2 841 | 1 799 | 464
Tués : 0 | 0 | 0
Pillage : Pierre 6 748 | Bois 7 044 | Fer 6 824 | Nourriture 0
Points gagnés : +0

Défenseur — Ninjas de Valyria
Genin | Chuunin | Jounin
Ninjas : 0 | 0 | 0
Tués : 0 | 0 | 0
Points gagnés : +0`;

  it('lit les deux sections et l’heure', () => {
    const { sections, attackedAt } = parseReportText(TEXT, paris(2026, 10, 29));
    assert.deepEqual(sections, [
      { village: 'Dragnir-City', side: 'Assaillant', ninjas: { genin: 2841, chuunin: 1799, jounin: 464 }, killed: { genin: 0, chuunin: 0, jounin: 0 } },
      { village: 'Valyria', side: 'Défenseur', ninjas: { genin: 0, chuunin: 0, jounin: 0 }, killed: { genin: 0, chuunin: 0, jounin: 0 } },
    ]);
    assert.equal(attackedAt, paris(2026, 10, 28, 6, 30));
  });

  it('reconnaît un rapport copié, pas un texte quelconque', () => {
    assert.equal(looksLikeReportText(TEXT), true);
    assert.equal(looksLikeReportText('Bonjour tout le monde'), false);
  });

  it('lit la copie du tableau du site (tabulations, sans « : »)', () => {
    const table = [
      'Assaillant\tNinjas de Reggaeton',
      'Genin\tChuunin\tJounin',
      'Ninjas\t1 951\t1 312\t303',
      'Tués\t0\t0\t0',
      'Pillage\tpierre13 839 | bois13 875 | fer13 907 | nourriture0',
      'Points gagnés : +1',
    ].join('\n');
    assert.equal(looksLikeReportText(table), true);
    assert.deepEqual(parseReportText(table).sections, [
      { village: 'Reggaeton', side: 'Assaillant', ninjas: { genin: 1951, chuunin: 1312, jounin: 303 }, killed: { genin: 0, chuunin: 0, jounin: 0 } },
    ]);
  });

  it('accepte des espaces multiples à la place des tabulations', () => {
    const spaced = 'Assaillant    Ninjas de Reggaeton\nNinjas    1 951    1 312    303\nTués    0    0    0';
    assert.deepEqual(parseReportText(spaced).sections[0].ninjas, { genin: 1951, chuunin: 1312, jounin: 303 });
  });
});
