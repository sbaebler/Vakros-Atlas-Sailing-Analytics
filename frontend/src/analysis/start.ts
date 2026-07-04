// Start analysis. Reconstructs the start line and gun time from the VKX line pings
// (0x05) and race-timer events (0x04); for CSV imports these can be supplied manually.
// Produces distance/time/speed to the line at the gun plus the final-approach series.

import { Sample } from '../parse/types';
import { ParsedTrack } from '../parse/types';
import { WindModel } from './wind';
import { MS_PER_KNOT } from '../parse/types';

export interface LatLon {
  lat: number;
  lon: number;
}
export interface StartLine {
  pin: LatLon;
  boat: LatLon;
}

export interface StartAnalysis {
  gunTime: number | null;
  line: StartLine | null;
  posAtGun: LatLon | null;
  distanceToLineM: number | null; // +behind (pre-start side), -over early
  side: 'behind' | 'over' | null;
  speedAtGunKts: number | null;
  timeToLineSec: number | null; // at gun speed, if behind
  approach: { t: number; distanceM: number; sog: number }[]; // last 60 s to gun
  lineLengthM: number | null;
}

export interface StartOverrides {
  line?: StartLine;
  gunTime?: number;
}

// Local ENU projection (metres) around an origin — fine at start-line scale.
function enu(p: LatLon, origin: LatLon): { e: number; n: number } {
  const D2R = Math.PI / 180;
  return {
    e: (p.lon - origin.lon) * Math.cos(origin.lat * D2R) * 111320,
    n: (p.lat - origin.lat) * 110540,
  };
}

export function lineFromPings(track: ParsedTrack): StartLine | null {
  const pin = lastOf(track.lines.filter((l) => l.end === 0));
  const boat = lastOf(track.lines.filter((l) => l.end === 1));
  if (!pin || !boat) return null;
  return { pin: { lat: pin.lat, lon: pin.lon }, boat: { lat: boat.lat, lon: boat.lon } };
}

export function gunTimeFromTimer(track: ParsedTrack): number | null {
  const raceStart = track.raceTimer.filter((e) => e.type === 3).pop();
  if (raceStart) return raceStart.t;
  // Fallback: a START event plus its countdown value.
  const start = track.raceTimer.filter((e) => e.type === 1).pop();
  if (start) return start.t + start.timer * 1000;
  return null;
}

function sampleAt(samples: Sample[], t: number): Sample | null {
  if (!samples.length) return null;
  let i = 0;
  while (i < samples.length - 1 && samples[i + 1].t < t) i++;
  return samples[i];
}

export function analyzeStart(
  track: ParsedTrack,
  wind: WindModel,
  overrides: StartOverrides = {},
): StartAnalysis {
  const samples = track.samples;
  const line = overrides.line ?? lineFromPings(track);
  const gunTime = overrides.gunTime ?? gunTimeFromTimer(track);

  const empty: StartAnalysis = {
    gunTime,
    line,
    posAtGun: null,
    distanceToLineM: null,
    side: null,
    speedAtGunKts: null,
    timeToLineSec: null,
    approach: [],
    lineLengthM: null,
  };
  if (!line || gunTime == null) return empty;

  const pin = line.pin;
  const boatEnd = enu(line.boat, pin);
  const lineLen = Math.hypot(boatEnd.e, boatEnd.n);
  if (lineLen < 1) return { ...empty, lineLengthM: lineLen };

  // Unit vector along the line and its normal (rotate -90°).
  const ux = boatEnd.e / lineLen;
  const uy = boatEnd.n / lineLen;
  let nx = uy;
  let ny = -ux;
  // Orient the normal toward the pre-start (downwind) side so +distance = behind line.
  const D2R = Math.PI / 180;
  const twd = wind.twdAt(gunTime);
  const windTowardE = -Math.sin(twd * D2R); // wind blows toward twd+180
  const windTowardN = -Math.cos(twd * D2R);
  if (nx * windTowardE + ny * windTowardN < 0) {
    nx = -nx;
    ny = -ny;
  }

  const signedDist = (p: LatLon): number => {
    const q = enu(p, pin);
    return q.e * nx + q.n * ny;
  };

  const posAtGun = sampleAt(samples, gunTime);
  const distanceToLineM = posAtGun ? signedDist(posAtGun) : null;
  const speedAtGunKts = posAtGun ? posAtGun.sog : null;
  const side =
    distanceToLineM == null ? null : distanceToLineM >= 0 ? 'behind' : 'over';
  const timeToLineSec =
    distanceToLineM != null && speedAtGunKts && speedAtGunKts > 0.1 && distanceToLineM > 0
      ? distanceToLineM / (speedAtGunKts / MS_PER_KNOT)
      : null;

  const approach = samples
    .filter((s) => s.t >= gunTime - 60_000 && s.t <= gunTime)
    .map((s) => ({ t: s.t, distanceM: signedDist(s), sog: s.sog }));

  return {
    gunTime,
    line,
    posAtGun: posAtGun ? { lat: posAtGun.lat, lon: posAtGun.lon } : null,
    distanceToLineM,
    side,
    speedAtGunKts,
    timeToLineSec,
    approach,
    lineLengthM: lineLen,
  };
}

function lastOf<T>(arr: T[]): T | undefined {
  return arr.length ? arr[arr.length - 1] : undefined;
}
