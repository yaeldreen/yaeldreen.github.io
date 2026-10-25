const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');
const pad = (n: number): string => String(n).padStart(2, '0');

export const formatNumber = (n: number): string => NUMBER_FORMAT.format(n);

/** Secondes → "2 j 3 h 5 min 10 s" (unités nulles omises). */
export function formatDuration(totalSeconds: number): string {
  const parts: [number, string][] = [
    [Math.floor(totalSeconds / 86400), 'j'],
    [Math.floor(totalSeconds / 3600) % 24, 'h'],
    [Math.floor(totalSeconds / 60) % 60, 'min'],
    [totalSeconds % 60, 's'],
  ];
  return parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}`).join(' ') || '0 s';
}

/** Centièmes de seconde → "MM:SS,CC" (ou "00:MM:SS,CC" avec `withHours`). */
export function formatSpeed(centiseconds: number, withHours = false): string {
  const minutes = Math.floor(centiseconds / 6000);
  const seconds = Math.floor(centiseconds / 100) % 60;
  return `${withHours ? '00:' : ''}${pad(minutes)}:${pad(seconds)},${pad(centiseconds % 100)}`;
}

/** Date → valeur compatible <input type="datetime-local" step="1"> (heure locale). */
export function toLocalIsoSeconds(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

export interface FormattedDateTime {
  time: string;
  date: string;
}

export function formatDateTime(ms: number): FormattedDateTime {
  const d = new Date(ms);
  return {
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    date: d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
  };
}
