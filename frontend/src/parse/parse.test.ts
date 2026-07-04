import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseVkx } from './vkx';
import { parseCsv } from './csv';

describe('VKX parser', () => {
  let vkx: ReturnType<typeof loadVkx>;
  
  beforeAll(() => {
    vkx = loadVkx();
  });

  it('parses PVO samples and metadata', () => {
    // rest of test
  });
});

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = resolve(here, '../../../01_Sample Data');
const BASENAME = 'Bernoulli  31.5.2026';

function loadVkx() {
  const buf = readFileSync(resolve(SAMPLE_DIR, `${BASENAME}.vkx`));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseVkx(ab as ArrayBuffer);
}
function loadCsv() {
  return parseCsv(readFileSync(resolve(SAMPLE_DIR, `${BASENAME}.csv`), 'utf8'));
}

describe('VKX parser', () => {
  const vkx = loadVkx();

  it('parses PVO samples and metadata', () => {
    expect(vkx.formatVersion).toBe(0x05); // R06 / VKX 1.4
    expect(vkx.loggingRateHz).toBe(2);
    expect(vkx.samples.length).toBeGreaterThan(8000);
  });

  it('positions are on the Zürichsee and speeds are plausible', () => {
    const s = vkx.samples[0];
    expect(s.lat).toBeGreaterThan(47.2);
    expect(s.lat).toBeLessThan(47.4);
    expect(s.lon).toBeGreaterThan(8.5);
    expect(s.lon).toBeLessThan(8.7);
    const maxSog = Math.max(...vkx.samples.map((x) => x.sog));
    expect(maxSog).toBeGreaterThan(5);
    expect(maxSog).toBeLessThan(12);
  });
});

describe('CSV parser', () => {
  const csv = loadCsv();
  it('parses all rows', () => {
    expect(csv.samples.length).toBeGreaterThan(8000);
    expect(csv.hasWind).toBe(false);
  });
});

describe('VKX quaternion decode matches CSV ground truth', () => {
  const vkx = loadVkx();
  const csv = loadCsv();

  // Index CSV samples by timestamp for direct comparison.
  const csvByT = new Map(csv.samples.map((s) => [s.t, s]));

  function stats(pick: (a: any, b: any) => number) {
    let n = 0;
    let sum = 0;
    let max = 0;
    for (const v of vkx.samples) {
      const c = csvByT.get(v.t);
      if (!c) continue;
      const d = Math.abs(pick(v, c));
      n++;
      sum += d;
      if (d > max) max = d;
    }
    return { n, mean: sum / n, max };
  }
  const angDiff = (a: number, b: number) => {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };

  it('has overlapping timestamps', () => {
    const overlap = vkx.samples.filter((v) => csvByT.has(v.t)).length;
    expect(overlap).toBeGreaterThan(1000);
  });

  it('heading agrees within a few degrees on average', () => {
    const s = stats((v, c) => angDiff(v.hdg, c.hdg));
    expect(s.mean).toBeLessThan(3);
  });

  it('heel agrees within a few degrees on average', () => {
    const s = stats((v, c) => v.heel - c.heel);
    expect(s.mean).toBeLessThan(3);
  });

  it('trim agrees within a few degrees on average', () => {
    const s = stats((v, c) => v.trim - c.trim);
    expect(s.mean).toBeLessThan(3);
  });
});
