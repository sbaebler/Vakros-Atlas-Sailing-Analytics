// Hybrid wind model.
//
//  - If the .vkx carries apparent-wind rows (Calypso sensor), we compute true wind per
//    reading by vector-subtracting boat velocity over ground  ->  source 'instrument'.
//  - Otherwise we need a true wind direction (TWD): prefer the device's own shift-angle
//    markers (0x06), else estimate it from the geometry of the sailed segments. True wind
//    speed (TWS) is taken from the user's manual input in this case.
//  - The user may always override TWD/TWS manually.

import { ParsedTrack, Sample } from '../parse/types';
import { angleDiff, circularMean, normalizeDeg } from './geo';
import { Segment } from './maneuvers';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type WindSource = 'instrument' | 'shift' | 'estimated' | 'manual';

export interface WindPoint {
  t: number;
  twd: number; // degrees, direction wind blows FROM
  tws: number; // knots
}

export interface WindModel {
  source: WindSource;
  points: WindPoint[]; // sorted by time; a single point means constant wind
  twdAt(t: number): number;
  twsAt(t: number): number;
}

export interface WindInput {
  mode?: 'auto' | 'manual'; // 'manual' ignores instrument/estimate and uses twd/tws
  twd?: number; // manual override, degrees FROM
  tws?: number; // manual override, knots
}

function makeModel(source: WindSource, points: WindPoint[]): WindModel {
  const pts = points.slice().sort((a, b) => a.t - b.t);
  const at = <K extends 'twd' | 'tws'>(t: number, key: K): number => {
    if (pts.length === 0) return 0;
    if (pts.length === 1 || t <= pts[0].t) return pts[0][key];
    if (t >= pts[pts.length - 1].t) return pts[pts.length - 1][key];
    let i = 0;
    while (i < pts.length - 1 && pts[i + 1].t < t) i++;
    const a = pts[i];
    const b = pts[i + 1];
    const f = (t - a.t) / (b.t - a.t);
    if (key === 'twd') return normalizeDeg(a.twd + angleDiff(b.twd, a.twd) * f);
    return a.tws + (b.tws - a.tws) * f;
  };
  return {
    source,
    points: pts,
    twdAt: (t) => at(t, 'twd'),
    twsAt: (t) => at(t, 'tws'),
  };
}

/** True wind from apparent-wind rows + boat velocity over ground. */
export function windFromInstrument(track: ParsedTrack): WindModel {
  const samples = track.samples;
  const points: WindPoint[] = [];
  let si = 0;
  for (const w of track.wind) {
    // nearest sample in time for boat velocity + heading
    while (si < samples.length - 1 && samples[si + 1].t < w.t) si++;
    const s = samples[si];
    // boat velocity "toward" vector (knots), x=east y=north
    const bx = s.sog * Math.sin(s.cog * D2R);
    const by = s.sog * Math.cos(s.cog * D2R);
    // apparent wind FROM direction over ground (awd measured relative to bow)
    const fromGround = normalizeDeg(s.hdg + w.awd);
    const ax = -w.aws * Math.sin(fromGround * D2R); // apparent "toward" vector
    const ay = -w.aws * Math.cos(fromGround * D2R);
    const tx = ax + bx; // true wind "toward"
    const ty = ay + by;
    const tws = Math.hypot(tx, ty);
    const twd = normalizeDeg(Math.atan2(tx, ty) * R2D + 180);
    points.push({ t: w.t, twd, tws });
  }
  return makeModel('instrument', points);
}

/** TWD from the device's port/starboard shift markers (bisector of the two tacks). */
export function windFromShifts(track: ParsedTrack, tws: number): WindModel | null {
  const stbd = track.shifts.filter((s) => s.tack === 0);
  const port = track.shifts.filter((s) => s.tack === 1);
  if (stbd.length === 0 || port.length === 0) return null;
  const twd = circularMean([
    circularMean(stbd.map((s) => s.heading)),
    circularMean(port.map((s) => s.heading)),
  ]);
  return makeModel('shift', [{ t: track.samples[0]?.t ?? 0, twd, tws }]);
}

/**
 * Estimate TWD from segment geometry: pick the pair of upwind tacks (two longer,
 * slower segments 40–150° apart) and take their bisector. Upwind is disambiguated
 * from downwind by lower average boat speed.
 */
export function estimateTwd(segments: Segment[]): number | null {
  const segs = segments.filter((s) => s.tEnd - s.tStart > 8000);
  if (segs.length < 2) return null;
  const speeds = segs.map((s) => s.avgSog).sort((a, b) => a - b);
  const medianSpeed = speeds[Math.floor(speeds.length / 2)];

  let best: { score: number; twd: number } | null = null;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const sep = Math.abs(angleDiff(segs[i].heading, segs[j].heading));
      if (sep < 40 || sep > 150) continue;
      const dur = (segs[i].tEnd - segs[i].tStart) + (segs[j].tEnd - segs[j].tStart);
      const slowness = 2 * medianSpeed - (segs[i].avgSog + segs[j].avgSog);
      const score = dur / 1000 + slowness * 500; // favour long, slow (upwind) pairs
      const twd = circularMean([segs[i].heading, segs[j].heading]);
      if (!best || score > best.score) best = { score, twd };
    }
  }
  return best ? best.twd : null;
}

/** Build the wind model for a session according to the hybrid strategy. */
export function buildWindModel(
  track: ParsedTrack,
  segments: Segment[],
  input: WindInput = {},
): WindModel {
  if (input.mode !== 'manual' && track.hasWind) {
    return windFromInstrument(track);
  }
  const tws = input.tws ?? 10;
  if (input.twd != null) {
    return makeModel('manual', [{ t: track.samples[0]?.t ?? 0, twd: input.twd, tws }]);
  }
  const shiftModel = windFromShifts(track, tws);
  if (shiftModel) return shiftModel;
  const est = estimateTwd(segments);
  const twd = est ?? 0;
  return makeModel('estimated', [{ t: track.samples[0]?.t ?? 0, twd, tws }]);
}

/** Fill twd/tws/twa/vmg on each sample from a wind model. */
export function applyWind(samples: Sample[], wind: WindModel): void {
  for (const s of samples) {
    const twd = wind.twdAt(s.t);
    const tws = wind.twsAt(s.t);
    s.twd = twd;
    s.tws = tws;
    s.twa = angleDiff(s.cog, twd); // -180..180, negative = wind on port bow
    s.vmg = s.sog * Math.cos(s.twa * D2R); // +ve upwind, -ve downwind
  }
}
