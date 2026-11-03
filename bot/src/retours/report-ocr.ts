import sharp from 'sharp';
import { ocrWorker } from '../shared/ocr-worker.js';
import { OcrWord, ParsedReport, parseReport, parseReportTime } from './report-parser.js';

/**
 * Lit une capture de rapport de combat : sections (Assaillant / Défenseur, village, troupes) et heure de l'attaque.
 * Les mots sont rangés par ligne avec leur position, pour retrouver les colonnes Genin / Chuunin / Jounin.
 */
export async function readReportImage(image: Buffer): Promise<{ sections: ParsedReport[]; attackedAt: number | null }> {
  const ocr = await ocrWorker();
  const { width = 1000 } = await sharp(image).metadata();
  // Les petites captures sont agrandies (meilleure lecture), les très grandes réduites (plus rapide).
  const target = Math.min(2400, Math.max(1600, width));
  const prepared = await sharp(image).resize({ width: target }).png().toBuffer();
  const { data } = await ocr.recognize(prepared, {}, { blocks: true });
  const lines: OcrWord[][] = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => line.words.map((w) => ({ text: w.text, x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 }))),
    ),
  );
  return { sections: parseReport(lines), attackedAt: parseReportTime(lines) };
}
