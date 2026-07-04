// Small geodesy helpers. Distances in metres, bearings/angles in degrees.

const R = 6371000; // mean Earth radius, metres
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * D2R;
  const dLon = (lon2 - lon1) * D2R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from point 1 to point 2, degrees 0..360. */
export function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const y = Math.sin((lon2 - lon1) * D2R) * Math.cos(lat2 * D2R);
  const x =
    Math.cos(lat1 * D2R) * Math.sin(lat2 * D2R) -
    Math.sin(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.cos((lon2 - lon1) * D2R);
  return ((Math.atan2(y, x) * R2D) % 360 + 360) % 360;
}

/** Smallest signed difference a-b, in range (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = ((a - b) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** Circular mean of a set of angles (degrees). */
export function circularMean(angles: number[]): number {
  let sx = 0;
  let sy = 0;
  for (const a of angles) {
    sx += Math.cos(a * D2R);
    sy += Math.sin(a * D2R);
  }
  return ((Math.atan2(sy, sx) * R2D) % 360 + 360) % 360;
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}
