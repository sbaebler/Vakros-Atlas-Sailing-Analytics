// Wind-agnostic segmentation of a track into straight "legs" (Schläge) separated by
// maneuvers (turns). We work on course-over-ground while moving and heading when slow,
// smooth it, flag samples where the boat is turning quickly, and split runs of
// non-turning samples into segments. Classification of each maneuver as tack/gybe/rounding
// is done later once the wind direction is known (see legs.ts / wind.ts).

import { Sample } from '../parse/types';
import { angleDiff, circularMean } from './geo';

export interface Segment {
  startIdx: number;
  endIdx: number; // inclusive
  tStart: number;
  tEnd: number;
  heading: number; // circular-mean course of the segment, degrees
  avgSog: number;
  distanceM: number;
}

export interface Maneuver {
  idx: number; // sample index near the turn apex (min SOG)
  t: number;
  beforeLeg: number; // index into segments[] of the leg entered from
  afterLeg: number; // index into segments[] of the leg exited into
  headingBefore: number;
  headingAfter: number;
  turn: number; // signed turn, degrees (-port / +stbd)
  entrySog: number;
  exitSog: number;
  minSog: number;
  recoverySec: number; // time from apex until SOG recovers to ~95% of entry
  // Assigned later, once wind is known:
  type?: 'tack' | 'gybe' | 'roundup' | 'bearaway' | 'other';
}

export interface Segmentation {
  segments: Segment[];
  maneuvers: Maneuver[];
}

const DEFAULTS = {
  moveSog: 0.8, // knots; below this use heading instead of COG
  smoothSec: 1.5, // heading smoothing window
  turnRateDegPerSec: 8, // above this the boat is considered "turning"
  minSegmentSec: 8, // ignore micro-segments
  minSailSog: 1.5, // knots; segments slower than this are "idle", not sailing legs
  maxManeuverGapSec: 25, // a maneuver is a quick turn; longer gaps are just a pause
};

function courseArray(samples: Sample[], moveSog: number): number[] {
  return samples.map((s) => (s.sog >= moveSog ? s.cog : s.hdg));
}

/** Circular moving-average smoothing over a time window. */
function smoothHeading(samples: Sample[], course: number[], windowSec: number): number[] {
  const out = new Array(course.length);
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < course.length; i++) {
    const tMin = samples[i].t - (windowSec * 1000) / 2;
    const tMax = samples[i].t + (windowSec * 1000) / 2;
    while (lo < i && samples[lo].t < tMin) lo++;
    if (hi < i) hi = i;
    while (hi < course.length - 1 && samples[hi + 1].t <= tMax) hi++;
    out[i] = circularMean(course.slice(lo, hi + 1));
  }
  return out;
}

export function segmentTrack(
  samples: Sample[],
  opts: Partial<typeof DEFAULTS> = {},
): Segmentation {
  const o = { ...DEFAULTS, ...opts };
  const n = samples.length;
  if (n < 3) return { segments: [], maneuvers: [] };

  const course = courseArray(samples, o.moveSog);
  const sm = smoothHeading(samples, course, o.smoothSec);

  // Per-sample turn rate (deg/s) from a short centred difference.
  const turning = new Array<boolean>(n).fill(false);
  for (let i = 1; i < n - 1; i++) {
    const dt = (samples[i + 1].t - samples[i - 1].t) / 1000;
    if (dt <= 0) continue;
    const rate = Math.abs(angleDiff(sm[i + 1], sm[i - 1])) / dt;
    turning[i] = rate > o.turnRateDegPerSec;
  }

  // Runs of non-turning samples -> candidate segments; keep only real sailing legs
  // (long enough and fast enough — drifting/idle time is discarded).
  const segments: Segment[] = [];
  let i = 0;
  while (i < n) {
    if (turning[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && !turning[j]) j++;
    const seg = buildSegment(samples, i, j - 1);
    if (
      seg.tEnd - seg.tStart >= o.minSegmentSec * 1000 &&
      seg.avgSog >= o.minSailSog
    ) {
      segments.push(seg);
    }
    i = j;
  }

  // A maneuver is a quick turn between two consecutive sailing legs (small time gap).
  const maneuvers: Maneuver[] = [];
  for (let k = 1; k < segments.length; k++) {
    const a = segments[k - 1];
    const b = segments[k];
    if (b.tStart - a.tEnd > o.maxManeuverGapSec * 1000) continue;
    maneuvers.push(buildManeuver(samples, k - 1, k, a, b));
  }

  return { segments, maneuvers };
}

function buildSegment(samples: Sample[], startIdx: number, endIdx: number): Segment {
  const slice = samples.slice(startIdx, endIdx + 1);
  const heading = circularMean(slice.map((s) => s.cog));
  const avgSog = slice.reduce((a, s) => a + s.sog, 0) / slice.length;
  let distanceM = 0;
  for (let i = 1; i < slice.length; i++) {
    const dtH = (slice[i].t - slice[i - 1].t) / 3_600_000;
    distanceM += ((slice[i].sog + slice[i - 1].sog) / 2) * dtH * 1852;
  }
  return {
    startIdx,
    endIdx,
    tStart: samples[startIdx].t,
    tEnd: samples[endIdx].t,
    heading,
    avgSog,
    distanceM,
  };
}

function buildManeuver(
  samples: Sample[],
  beforeLeg: number,
  afterLeg: number,
  a: Segment,
  b: Segment,
): Maneuver {
  // Find the SOG minimum in the turn window between the two segments.
  let apex = a.endIdx;
  let minSog = Infinity;
  for (let i = a.endIdx; i <= b.startIdx; i++) {
    if (samples[i].sog < minSog) {
      minSog = samples[i].sog;
      apex = i;
    }
  }
  const entrySog = a.avgSog;
  const exitSog = b.avgSog;
  // Recovery: time from apex until SOG climbs back to 95% of entry speed.
  const target = 0.95 * entrySog;
  let recIdx = b.startIdx;
  for (let i = apex; i <= b.endIdx; i++) {
    if (samples[i].sog >= target) {
      recIdx = i;
      break;
    }
  }
  return {
    idx: apex,
    t: samples[apex].t,
    beforeLeg,
    afterLeg,
    headingBefore: a.heading,
    headingAfter: b.heading,
    turn: angleDiff(b.heading, a.heading),
    entrySog,
    exitSog,
    minSog,
    recoverySec: (samples[recIdx].t - samples[apex].t) / 1000,
  };
}
