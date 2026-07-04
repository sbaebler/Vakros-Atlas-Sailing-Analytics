// Display formatting helpers.

export const kt = (v: number | null | undefined) =>
  v == null ? '–' : `${v.toFixed(1)} kt`;
export const deg = (v: number | null | undefined) =>
  v == null ? '–' : `${Math.round(v)}°`;
export const m = (v: number | null | undefined) =>
  v == null ? '–' : `${Math.round(v)} m`;
export const pct = (v: number | null | undefined) =>
  v == null ? '–' : `${Math.round(v)}%`;
export const nm = (v: number | null | undefined) =>
  v == null ? '–' : `${v.toFixed(2)} nm`;

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m ${s}s`;
}

export function clock(t: number): string {
  return new Date(t).toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function dateStr(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-CH');
}
