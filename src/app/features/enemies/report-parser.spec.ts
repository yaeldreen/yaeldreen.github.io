import { OcrWord, parseReport } from './report-parser';

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
    expect(parseReport(SAMPLE)).toEqual([
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
    expect(parsed).toEqual([
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
    expect(parsed).toEqual([
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
    expect(parseReport([line('Bonjour@10', 'tout@50', 'le@80', 'monde@110')])).toEqual([]);
  });
});
