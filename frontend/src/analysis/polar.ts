// Boat polar model. A polar is a grid of target boat speed (knots) indexed by
// true wind speed (TWS, knots) and true wind angle (TWA, degrees 0..180). We
// bilinearly interpolate the grid and derive the optimal upwind/downwind VMG angles.

export interface Polar {
  name: string;
  twsValues: number[]; // ascending, e.g. [4,6,8,10,12,14,16,20]
  twaValues: number[]; // ascending 0..180, e.g. [0,30,40,...,180]
  // speeds[twaIndex][twsIndex] = target boat speed in knots
  speeds: number[][];
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Index bracket + fraction for a value within an ascending axis (clamped). */
function bracket(values: number[], v: number): [number, number, number] {
  if (v <= values[0]) return [0, 0, 0];
  const last = values.length - 1;
  if (v >= values[last]) return [last, last, 0];
  let i = 0;
  while (i < last && values[i + 1] < v) i++;
  const f = (v - values[i]) / (values[i + 1] - values[i]);
  return [i, i + 1, f];
}

/** Target boat speed (knots) for a given TWA (0..180) and TWS. */
export function polarTargetSpeed(polar: Polar, twaAbs: number, tws: number): number {
  const a = Math.min(180, Math.max(0, Math.abs(twaAbs)));
  const [ta0, ta1, tf] = bracket(polar.twaValues, a);
  const [ts0, ts1, sf] = bracket(polar.twsValues, tws);
  const s00 = polar.speeds[ta0][ts0];
  const s01 = polar.speeds[ta0][ts1];
  const s10 = polar.speeds[ta1][ts0];
  const s11 = polar.speeds[ta1][ts1];
  return lerp(lerp(s00, s01, sf), lerp(s10, s11, sf), tf);
}

/** Actual speed as a percentage of the polar target. */
export function percentOfPolar(
  polar: Polar,
  sog: number,
  twaAbs: number,
  tws: number,
): number {
  const target = polarTargetSpeed(polar, twaAbs, tws);
  if (target <= 0.01) return 0;
  return (sog / target) * 100;
}

export interface VmgTarget {
  twa: number; // optimal true wind angle (0..180)
  boatSpeed: number; // target boat speed at that angle
  vmg: number; // resulting velocity made good
}

/** Optimal upwind and downwind VMG angles for a given TWS (1° search). */
export function optimalVmg(
  polar: Polar,
  tws: number,
): { upwind: VmgTarget; downwind: VmgTarget } {
  let up: VmgTarget = { twa: 45, boatSpeed: 0, vmg: -Infinity };
  let down: VmgTarget = { twa: 150, boatSpeed: 0, vmg: -Infinity };
  for (let a = 0; a <= 180; a++) {
    const bs = polarTargetSpeed(polar, a, tws);
    const vmg = bs * Math.cos((a * Math.PI) / 180); // +ve upwind, -ve downwind
    if (a < 90 && vmg > up.vmg) up = { twa: a, boatSpeed: bs, vmg };
    if (a > 90 && -vmg > down.vmg) down = { twa: a, boatSpeed: bs, vmg: -vmg };
  }
  return { upwind: up, downwind: down };
}

/**
 * A generic keelboat polar, used as the starting point when the user creates a
 * new boat. Values are illustrative and meant to be edited in the polar editor.
 */
export function defaultKeelboatPolar(): Polar {
  const twsValues = [4, 6, 8, 10, 12, 14, 16, 20];
  const twaValues = [0, 30, 40, 52, 60, 75, 90, 110, 120, 135, 150, 165, 180];
  // Rough target speeds (knots) for a ~35ft cruiser-racer.
  const speeds = [
    [0, 0, 0, 0, 0, 0, 0, 0], // 0
    [0, 0, 0, 0, 0, 0, 0, 0], // 30 (in irons)
    [3.6, 4.6, 5.3, 5.8, 6.1, 6.3, 6.4, 6.6], // 40
    [4.4, 5.4, 6.1, 6.5, 6.8, 7.0, 7.1, 7.3], // 52 (upwind VMG)
    [4.7, 5.7, 6.4, 6.8, 7.1, 7.3, 7.4, 7.6], // 60
    [5.1, 6.1, 6.8, 7.2, 7.5, 7.7, 7.9, 8.2], // 75
    [5.3, 6.3, 7.0, 7.5, 7.8, 8.1, 8.3, 8.7], // 90
    [5.2, 6.2, 6.9, 7.5, 7.9, 8.3, 8.6, 9.2], // 110
    [4.9, 5.9, 6.7, 7.3, 7.8, 8.2, 8.6, 9.4], // 120
    [4.3, 5.3, 6.1, 6.8, 7.3, 7.8, 8.2, 9.2], // 135 (downwind VMG)
    [3.6, 4.5, 5.3, 6.0, 6.5, 7.0, 7.5, 8.6], // 150
    [2.9, 3.7, 4.4, 5.0, 5.5, 6.0, 6.5, 7.6], // 165
    [2.5, 3.2, 3.8, 4.4, 4.9, 5.4, 5.9, 7.0], // 180
  ];
  return { name: 'Generic keelboat', twsValues, twaValues, speeds };
}
