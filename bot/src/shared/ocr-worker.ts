import { createWorker, Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;

/**
 * Moteur de lecture d'image (français), partagé par tous les salons et créé à la première capture
 * (données de langue téléchargées une fois, gardées dans bot/.tesseract-cache).
 */
export const ocrWorker = (): Promise<Worker> =>
  (worker ??= createWorker('fra', undefined, { cachePath: new URL('../../.tesseract-cache', import.meta.url).pathname }).catch((e) => {
    worker = null;
    throw e;
  }));
