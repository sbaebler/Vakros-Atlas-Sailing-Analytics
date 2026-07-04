// Fallback parser for the Vakaros CSV export. The export contains only the derived
// position/velocity/orientation channel; there are no line pings, race-timer events,
// shift markers, or wind rows (those live only in the .vkx binary).
//
// Expected header (order-independent, matched by name):
//   timestamp,latitude,longitude,sog_kts,cog,hdg_true,heel,trim

import { emptyTrack, ParsedTrack, Sample } from './types';
import { normalizeDeg } from './vkx';

export function parseCsv(text: string): ParsedTrack {
  const track = emptyTrack('csv');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return track;

  const header = splitRow(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iTs = col('timestamp');
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iSog = col('sog_kts');
  const iCog = col('cog');
  const iHdg = col('hdg_true');
  const iHeel = col('heel');
  const iTrim = col('trim');

  if (iTs < 0 || iLat < 0 || iLon < 0) {
    throw new Error('CSV: missing required timestamp/latitude/longitude columns');
  }

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    const f = splitRow(raw);
    const t = Date.parse(f[iTs]);
    if (Number.isNaN(t)) continue;
    const s: Sample = {
      t,
      lat: num(f[iLat]),
      lon: num(f[iLon]),
      sog: iSog >= 0 ? num(f[iSog]) : 0,
      cog: iCog >= 0 ? normalizeDeg(num(f[iCog])) : 0,
      hdg: iHdg >= 0 ? normalizeDeg(num(f[iHdg])) : 0,
      heel: iHeel >= 0 ? num(f[iHeel]) : 0,
      trim: iTrim >= 0 ? num(f[iTrim]) : 0,
    };
    track.samples.push(s);
  }

  track.samples.sort((a, b) => a.t - b.t);
  return track;
}

function splitRow(row: string): string[] {
  // The Vakaros export is a plain comma CSV with no quoted fields, but be defensive.
  return row.split(',');
}

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
