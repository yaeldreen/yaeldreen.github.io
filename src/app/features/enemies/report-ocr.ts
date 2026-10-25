import type { Worker } from 'tesseract.js';
import { OcrWord, ParsedReport, parseReport, parseReportTime } from './report-parser';

export interface ReadReport {
  sections: ParsedReport[];
  /** Heure du titre du rapport (ms), null si illisible. */ attackedAt: number | null;
}

/** Au-delà, l'image est réduite avant la lecture : les iPhone limitent fortement la mémoire du moteur OCR. */
const MAX_SIDE = 1600;

let worker: Promise<Worker> | null = null;

const getWorker = (): Promise<Worker> => {
  worker ??= import('tesseract.js')
    .then(({ createWorker }) => createWorker('fra'))
    .catch((e: unknown) => {
      // Un échec (réseau, mémoire…) ne doit pas bloquer les tentatives suivantes.
      worker = null;
      throw e;
    });
  return worker;
};

/**
 * Redessine l'image en PNG (réduite si besoin) : normalise les formats venant du presse-papiers
 * ou de la photothèque iPhone et limite la mémoire utilisée par l'OCR.
 */
async function prepareImage(image: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    return image; // Format non décodable ici : on laisse Tesseract essayer.
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? image), 'image/png'));
}

/**
 * Lit les sections (Assaillant, Défenseur…) d'une capture de rapport de combat dans le navigateur (Tesseract, français).
 * La bibliothèque n'est chargée qu'au premier appel ; le moteur et le modèle de langue sont
 * téléchargés une fois, l'image elle-même n'est envoyée nulle part.
 */
export async function readReportImage(image: Blob): Promise<ReadReport> {
  const [ocr, prepared] = await Promise.all([getWorker(), prepareImage(image)]);
  let data;
  try {
    ({ data } = await ocr.recognize(prepared, {}, { blocks: true }));
  } catch (e) {
    // Moteur planté (souvent la mémoire sur mobile) : on le recrée à la prochaine lecture.
    worker = null;
    void ocr.terminate().catch(() => undefined);
    throw e;
  }

  const lines: OcrWord[][] = (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) =>
        line.words.map((w) => ({ text: w.text, x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 })),
      ),
    ),
  );
  return { sections: parseReport(lines), attackedAt: parseReportTime(lines) };
}

/** Texte court d'une erreur de lecture, à afficher pour le diagnostic. */
export const ocrErrorDetail = (e: unknown): string =>
  (e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e) ?? 'inconnue').slice(0, 200);
