// Orchestrates the full analysis of a parsed track into a session summary that the UI
// renders and the backend caches as JSON.

import { ParsedTrack, Sample } from '../parse/types';
import { haversine } from './geo';
import { Maneuver, Segmentation, segmentTrack } from './maneuvers';
import { buildLegs, classifyManeuvers, Leg } from './legs';
import { Polar } from './polar';
import { analyzeStart, StartAnalysis, StartOverrides } from './start';
import { applyWind, buildWindModel, WindInput, WindModel } from './wind';

export interface SessionStats {
  durationSec: number;
  distanceNm: number;
  maxSog: number;
  avgSog: number;
  maxHeel: number;
  numTacks: number;
  numGybes: number;
  windSource: WindModel['source'];
  twd: number;
  tws: number;
}

export interface Analysis {
  wind: WindModel;
  segmentation: Segmentation;
  legs: Leg[];
  maneuvers: Maneuver[];
  start: StartAnalysis;
  stats: SessionStats;
}

export interface AnalyzeOptions {
  wind?: WindInput;
  polar?: Polar | null;
  start?: StartOverrides;
}

export function analyze(track: ParsedTrack, opts: AnalyzeOptions = {}): Analysis {
  const samples = track.samples;
  const seg = segmentTrack(samples);
  const wind = buildWindModel(track, seg.segments, opts.wind ?? {});
  applyWind(samples, wind);

  const legs = buildLegs(samples, seg.segments, wind, opts.polar ?? null);
  classifyManeuvers(seg.maneuvers, legs);
  const start = analyzeStart(track, wind, opts.start ?? {});

  return {
    wind,
    segmentation: seg,
    legs,
    maneuvers: seg.maneuvers,
    start,
    stats: summarize(samples, seg.maneuvers, wind),
  };
}

function summarize(
  samples: Sample[],
  maneuvers: Maneuver[],
  wind: WindModel,
): SessionStats {
  const n = samples.length;
  const durationSec = n ? (samples[n - 1].t - samples[0].t) / 1000 : 0;
  let distanceM = 0;
  let maxSog = 0;
  let sumSog = 0;
  let maxHeel = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    maxSog = Math.max(maxSog, s.sog);
    sumSog += s.sog;
    maxHeel = Math.max(maxHeel, Math.abs(s.heel));
    if (i > 0) {
      distanceM += haversine(
        samples[i - 1].lat,
        samples[i - 1].lon,
        s.lat,
        s.lon,
      );
    }
  }
  const midT = n ? samples[Math.floor(n / 2)].t : 0;
  return {
    durationSec,
    distanceNm: distanceM / 1852,
    maxSog,
    avgSog: n ? sumSog / n : 0,
    maxHeel,
    numTacks: maneuvers.filter((m) => m.type === 'tack').length,
    numGybes: maneuvers.filter((m) => m.type === 'gybe').length,
    windSource: wind.source,
    twd: wind.twdAt(midT),
    tws: wind.twsAt(midT),
  };
}
