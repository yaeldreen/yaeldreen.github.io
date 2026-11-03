import sharp from 'sharp';
import { ocrWorker } from '../shared/ocr-worker.js';
import { mostCommon, parseCostsLine, parseLevel, UpgradeCosts } from './upgrade-parse.js';

/**
 * Lit une capture « Coûts pour passer au niveau N » du jeu.
 * Le texte des coûts est blanc pur alors que les icônes sont grises ou colorées : on ne garde que les pixels très
 * clairs (plusieurs seuils), puis on retient la lecture la plus fréquente. Le titre, jaune, est lu à part.
 */
const COST_THRESHOLDS = [200, 215, 230, 245];

export async function readUpgradeScreenshot(image: Buffer): Promise<{ level: number | null; costs: UpgradeCosts | null }> {
  const ocr = await ocrWorker();
  const { width = 1000 } = await sharp(image).metadata();
  // Agrandir aide la lecture des petits chiffres ; on plafonne pour garder une lecture rapide.
  const scaled = () => sharp(image).resize({ width: Math.min(4000, Math.round(width * 2.5)) }).greyscale();

  const read = async (buffer: Buffer) => (await ocr.recognize(buffer)).data.text;
  const title = await read(await scaled().negate({ alpha: false }).normalize().png().toBuffer());
  const readings: string[] = [title];
  for (const threshold of COST_THRESHOLDS) {
    readings.push(await read(await scaled().threshold(threshold).negate({ alpha: false }).png().toBuffer()));
  }
  return {
    level: readings.map(parseLevel).find((l) => l !== null) ?? null,
    costs: mostCommon(readings.slice(1).map(parseCostsLine)),
  };
}
