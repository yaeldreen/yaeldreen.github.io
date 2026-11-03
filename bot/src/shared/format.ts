/** Mise en forme commune aux salons : nombres, durées, découpage des fiches Discord. */

const NUMBER = new Intl.NumberFormat('fr-FR');

/** 14034 → "14 034" (espace normale : les espaces fines s'affichent mal sur certains téléphones). */
export const num = (v: number): string => NUMBER.format(v).replace(/[  ]/g, ' ');

/** Secondes → "2 j 3 h 5 min 10 s" (unités nulles omises). */
export function formatDuration(totalSeconds: number): string {
  const parts: [number, string][] = [
    [Math.floor(totalSeconds / 86400), 'j'],
    [Math.floor(totalSeconds / 3600) % 24, 'h'],
    [Math.floor(totalSeconds / 60) % 60, 'min'],
    [Math.round(totalSeconds % 60), 's'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}`).join(' ') || '0 s';
}

export interface EmbedField {
  name: string;
  value: string;
}

/** Regroupe des fiches en paquets sous les limites d'un message Discord (25 fiches, ~6 000 caractères). */
export function chunkFields(fields: readonly EmbedField[], maxFields = 25, maxChars = 5000): EmbedField[][] {
  const pages: EmbedField[][] = [];
  let page: EmbedField[] = [];
  let chars = 0;
  for (const field of fields) {
    const size = field.name.length + field.value.length;
    if (page.length && (page.length >= maxFields || chars + size > maxChars)) {
      pages.push(page);
      page = [];
      chars = 0;
    }
    page.push(field);
    chars += size;
  }
  if (page.length) pages.push(page);
  return pages;
}
