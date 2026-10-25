/**
 * Lit la première image du presse-papiers. À appeler depuis un clic : sur iPhone, il n'y a pas de Cmd+V
 * sur la page, et Safari affiche alors une bulle « Coller » à confirmer.
 * Retourne null si le presse-papiers ne contient pas d'image ; lève une erreur si l'accès est refusé ou impossible.
 */
export async function readClipboardImage(): Promise<Blob | null> {
  if (!navigator.clipboard?.read) throw new Error('Presse-papiers non disponible');
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) return item.getType(type);
  }
  return null;
}
