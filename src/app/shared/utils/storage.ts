// Choix mémorisés dans le navigateur de chaque joueur (si le stockage est disponible).

export const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix ne sera simplement pas retenu.
  }
};
