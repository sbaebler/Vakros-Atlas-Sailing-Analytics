import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseVkx } from '../parse/vkx';
import { emptyTrack } from '../parse/types';
import { analyze } from './analyze';
import { windFromInstrument } from './wind';
import {
  defaultKeelboatPolar,
  optimalVmg,
  percentOfPolar,
  polarTargetSpeed,
} from './polar';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(here, '../../../01_Sample Data/Bernoulli  31.5.2026.vkx');
const hasSample = existsSync(SAMPLE);

function loadSample() {
  const buf = readFileSync(SAMPLE);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseVkx(ab as ArrayBuffer);
}

describe('polar model', () => {
  const polar = defaultKeelboatPolar();
  it('interpolates target speed and clamps out-of-range', () => {
    expect(polarTargetSpeed(polar, 52, 12)).toBeCloseTo(6.8, 1);
    expect(polarTargetSpeed(polar, 52, 100)).toBe(polarTargetSpeed(polar, 52, 20));
    expect(polarTargetSpeed(polar, 999, 12)).toBe(polarTargetSpeed(polar, 180, 12));
  });
  it('percent of polar is 100 when hitting target', () => {
    const t = polarTargetSpeed(polar, 60, 12);
    expect(percentOfPolar(polar, t, 60, 12)).toBeCloseTo(100, 5);
  });
  it('optimal VMG angles are sane', () => {
    const { upwind, downwind } = optimalVmg(polar, 12);
    expect(upwind.twa).toBeGreaterThan(38);
    expect(upwind.twa).toBeLessThan(58);
    expect(downwind.twa).toBeGreaterThan(120);
    expect(downwind.twa).toBeLessThan(170);
  });
});

describe('instrument true wind', () => {
  it('stationary boat: true wind equals apparent', () => {
    const t = emptyTrack('vkx');
    t.samples.push({ t: 1000, lat: 47, lon: 8, sog: 0, cog: 0, hdg: 0, heel: 0, trim: 0 });
    t.wind.push({ t: 1000, awd: 90, aws: 10 });
    const w = windFromInstrument(t);
    expect(w.twsAt(1000)).toBeCloseTo(10, 3);
    expect(w.twdAt(1000)).toBeCloseTo(90, 1);
  });
  it('sailing upwind adds boatspeed to apparent', () => {
    const t = emptyTrack('vkx');
    t.samples.push({ t: 1000, lat: 47, lon: 8, sog: 5, cog: 0, hdg: 0, heel: 0, trim: 0 });
    t.wind.push({ t: 1000, awd: 0, aws: 15 }); // dead ahead
    const w = windFromInstrument(t);
    expect(w.twsAt(1000)).toBeCloseTo(10, 3);
    expect(w.twdAt(1000)).toBeCloseTo(0, 1);
  });
});

// The private sample recording isn't committed to the repo (see .gitignore), so this
// suite only runs where it's present (e.g. locally), not in CI.
if (hasSample) {
  describe('full analysis on the Bernoulli sample', () => {
    const track = loadSample();
    const a = analyze(track, { polar: defaultKeelboatPolar(), wind: { tws: 12 } });

    it('produces segments and detects maneuvers', () => {
      expect(a.segmentation.segments.length).toBeGreaterThan(1);
      expect(a.maneuvers.length).toBeGreaterThan(0);
    });
    it('estimates a wind direction', () => {
      expect(a.stats.windSource).toBe('estimated');
      expect(a.stats.twd).toBeGreaterThanOrEqual(0);
      expect(a.stats.twd).toBeLessThan(360);
    });
    it('classifies legs with polar percentages', () => {
      const withPolar = a.legs.filter((l) => l.percentPolar != null);
      expect(withPolar.length).toBe(a.legs.length);
      // sanity: percentages are in a believable band on average
      const avg =
        withPolar.reduce((s, l) => s + (l.percentPolar ?? 0), 0) / withPolar.length;
      expect(avg).toBeGreaterThan(20);
      expect(avg).toBeLessThan(200);
    });
    it('summary stats are sane', () => {
      expect(a.stats.durationSec).toBeGreaterThan(3000);
      expect(a.stats.distanceNm).toBeGreaterThan(1);
      expect(a.stats.maxSog).toBeGreaterThan(5);
    });
  });
}
