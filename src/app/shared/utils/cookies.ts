// Cookies propres au navigateur de chaque joueur (jamais envoyés ailleurs : le site est statique).

const ONE_YEAR_S = 365 * 24 * 3600;

export const readCookie = (name: string): string | null => {
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const found = document.cookie.split('; ').find((c) => c.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : null;
  } catch {
    return null;
  }
};

export const writeCookie = (name: string, value: string, maxAgeS = ONE_YEAR_S): void => {
  try {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${maxAgeS}; path=/; SameSite=Lax`;
  } catch {
    // Cookies bloqués : la valeur ne sera simplement pas retenue.
  }
};
