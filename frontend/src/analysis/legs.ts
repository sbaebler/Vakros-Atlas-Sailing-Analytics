// Classify each straight segment (Schlag) as upwind / reach / downwind using the wind
// model, compute per-leg performance stats including % of polar target, and label each
// maneuver as tack / gybe / rounding based on the point of sail before and after.

import { Sample } from '../parse/types';
import { angleDiff } from './geo';
import { Maneuver, Segment } from './maneuvers';
import { Polar, percentOfPolar } from './polar';
import { WindModel } from './wind';

export type PointOfSail = 'upwind' | 'reach' | 'downwind';

export interface Leg extends Segment {
  pointOfSail: PointOfSail;
  tack: 'port' | 'starboard';
  avgTwa: number; // absolute, 0..180
  avgTws: number;
  avgVmg: number;
  avgHeel: number;
  headingStdDev: number; // steering consistency, degrees
  percentPolar: number | null; // vs polar target, null if no polar
}

export function classifyPointOfSail(twaAbs: number): PointOfSail {
  if (twaAbs < 70) return 'upwind';
  if (twaAbs > 110) return 'downwind';
  return 'reach';
}

export function buildLegs(
  samples: Sample[],
  segments: Segment[],
  wind: WindModel,
  polar: Polar | null,
): Leg[] {
  return segments.map((seg) => {
    const slice = samples.slice(seg.startIdx, seg.endIdx + 1);
    const twd = wind.twdAt((seg.tStart + seg.tEnd) / 2);
    const twaSigned = angleDiff(seg.heading, twd);
    const twaAbs = Math.abs(twaSigned);
    const avgTws = mean(slice.map((s) => s.tws ?? wind.twsAt(s.t)));
    const avgSog = seg.avgSog;
    const avgVmg = mean(slice.map((s) => s.vmg ?? 0));
    const avgHeel = mean(slice.map((s) => s.heel));
    const headingStdDev = circularStdDev(slice.map((s) => s.cog));
    const percentPolar = polar
      ? percentOfPolar(polar, avgSog, twaAbs, avgTws)
      : null;
    return {
      ...seg,
      pointOfSail: classifyPointOfSail(twaAbs),
      tack: twaSigned < 0 ? 'port' : 'starboard',
      avgTwa: twaAbs,
      avgTws,
      avgVmg,
      avgHeel,
      headingStdDev,
      percentPolar,
    };
  });
}

/** Label maneuvers now that we know the point of sail on each side. */
export function classifyManeuvers(maneuvers: Maneuver[], legs: Leg[]): void {
  for (const m of maneuvers) {
    const before = legs[m.beforeLeg];
    const after = legs[m.afterLeg];
    if (!before || !after) {
      m.type = 'other';
      continue;
    }
    const a = before.pointOfSail;
    const b = after.pointOfSail;
    if (a === 'upwind' && b === 'upwind') m.type = 'tack';
    else if (a === 'downwind' && b === 'downwind') m.type = 'gybe';
    else if (a === 'upwind' && b === 'downwind') m.type = 'bearaway';
    else if (a === 'downwind' && b === 'upwind') m.type = 'roundup';
    else m.type = 'other';
  }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function circularStdDev(anglesDeg: number[]): number {
  if (!anglesDeg.length) return 0;
  const D2R = Math.PI / 180;
  let sx = 0;
  let sy = 0;
  for (const a of anglesDeg) {
    sx += Math.cos(a * D2R);
    sy += Math.sin(a * D2R);
  }
  const r = Math.hypot(sx, sy) / anglesDeg.length;
  return (Math.sqrt(Math.max(0, -2 * Math.log(Math.max(r, 1e-9)))) * 180) / Math.PI;
}
