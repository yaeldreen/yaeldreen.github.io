import type { Worker } from 'tesseract.js';
import { OcrWord, ParsedReport, parseReport } from './report-parser';

let worker: Promise<Worker> | null = null;

/**
 * Lit les sections (Assaillant, Défenseur…) d'une capture de rapport de combat dans le navigateur (Tesseract, français).
 * La bibliothèque n'est chargée qu'au premier appel ; le moteur et le modèle de langue sont
 * téléchargés une fois, l'image elle-même n'est envoyée nulle part.
 */
export async function readReportImage(image: Blob): Promise<ParsedReport[]> {
  worker ??= import('tesseract.js').then(({ createWorker }) => createWorker('fra'));
  const { data } = await (await worker).recognize(image, {}, { blocks: true });

  const lines: OcrWord[][] = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) =>
        line.words.map((w) => ({ text: w.text, x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 })),
      ),
    ),
  );
  return parseReport(lines);
}
