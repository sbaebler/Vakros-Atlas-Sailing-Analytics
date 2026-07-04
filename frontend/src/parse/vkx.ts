// Parser for the Vakaros VKX telemetry log format (spec: https://github.com/vakaros/vkx).
// A VKX file is a flat stream of rows: one U1 key byte followed by a fixed-size payload.
// All multi-byte values are little-endian. We walk the stream key by key; to advance past
// rows we do not decode we still need their exact payload size, so ROW_SIZES lists every
// documented row (public + Vakaros-internal). An unknown key is unrecoverable -> we throw.

import {
  emptyTrack,
  MS_PER_KNOT,
  ParsedTrack,
  Sample,
} from './types';

const RAD2DEG = 180 / Math.PI;

// Payload size in bytes for every row key (the 1-byte key itself is not included).
const ROW_SIZES: Record<number, number> = {
  0x01: 32, // internal
  0x02: 44, // Position/Velocity/Orientation
  0x03: 20, // Declination
  0x04: 13, // Race Timer Event
  0x05: 17, // Line Position
  0x06: 18, // Shift Angle
  0x07: 12, // internal
  0x08: 13, // Device Configuration
  0x0a: 16, // Wind (apparent)
  0x0b: 16, // Speed Through Water
  0x0c: 12, // Depth
  0x0e: 16, // internal
  0x0f: 16, // Load
  0x10: 12, // Temperature
  0x20: 13, // internal
  0x21: 52, // internal
  0xfe: 2, // Page Terminator
  0xff: 7, // Page Header
};

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Convert a device orientation quaternion (w,x,y,z, body-in-NED) into
 * heading/heel/trim in degrees. Standard aerospace ZYX (yaw-pitch-roll) extraction.
 * Sign conventions are validated against the CSV export in the parser tests.
 */
export function quaternionToEuler(
  w: number,
  x: number,
  y: number,
  z: number,
): { hdg: number; heel: number; trim: number } {
  // Roll (rotation about North/x) -> heel
  const heel = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)) * RAD2DEG;
  // Pitch (rotation about East/y) -> trim
  const sinp = 2 * (w * y - z * x);
  const trim = Math.asin(Math.max(-1, Math.min(1, sinp))) * RAD2DEG;
  // Yaw (rotation about Down/z) -> heading
  const hdg = normalizeDeg(
    Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)) * RAD2DEG,
  );
  return { hdg, heel, trim };
}

export function parseVkx(buffer: ArrayBuffer): ParsedTrack {
  const view = new DataView(buffer);
  const len = buffer.byteLength;
  const track = emptyTrack('vkx');
  let pos = 0;

  while (pos < len) {
    const key = view.getUint8(pos);
    const size = ROW_SIZES[key];
    if (size === undefined) {
      throw new Error(
        `VKX: unknown row key 0x${key.toString(16)} at byte ${pos} (cannot determine length)`,
      );
    }
    const p = pos + 1; // payload start
    if (p + size > len) break; // truncated final row

    switch (key) {
      case 0xff: {
        // Page header: byte 0 is the format version.
        track.formatVersion = view.getUint8(p);
        break;
      }
      case 0x08: {
        // Device configuration: logging rate in Hz at payload offset 12.
        track.loggingRateHz = view.getUint8(p + 12);
        break;
      }
      case 0x02: {
        const t = readU8ms(view, p);
        const lat = view.getInt32(p + 8, true) * 1e-7;
        const lon = view.getInt32(p + 12, true) * 1e-7;
        const sog = view.getFloat32(p + 16, true) * MS_PER_KNOT;
        const cog = normalizeDeg(view.getFloat32(p + 20, true) * RAD2DEG);
        const alt = view.getFloat32(p + 24, true);
        const qw = view.getFloat32(p + 28, true);
        const qx = view.getFloat32(p + 32, true);
        const qy = view.getFloat32(p + 36, true);
        const qz = view.getFloat32(p + 40, true);
        const { hdg, heel, trim } = quaternionToEuler(qw, qx, qy, qz);
        const s: Sample = { t, lat, lon, sog, cog, hdg, heel, trim, alt };
        track.samples.push(s);
        break;
      }
      case 0x04: {
        track.raceTimer.push({
          t: readU8ms(view, p),
          type: view.getUint8(p + 8),
          timer: view.getInt32(p + 9, true),
        });
        break;
      }
      case 0x05: {
        track.lines.push({
          t: readU8ms(view, p),
          end: view.getUint8(p + 8) === 1 ? 1 : 0,
          lat: view.getFloat32(p + 9, true),
          lon: view.getFloat32(p + 13, true),
        });
        break;
      }
      case 0x06: {
        track.shifts.push({
          t: readU8ms(view, p),
          tack: view.getUint8(p + 8) === 1 ? 1 : 0,
          manual: view.getUint8(p + 9) === 1,
          heading: normalizeDeg(view.getFloat32(p + 10, true)),
          sog: view.getFloat32(p + 14, true),
        });
        break;
      }
      case 0x0a: {
        track.wind.push({
          t: readU8ms(view, p),
          awd: normalizeDeg(view.getFloat32(p + 8, true)),
          aws: view.getFloat32(p + 12, true) * MS_PER_KNOT,
        });
        break;
      }
      case 0x0b: {
        track.stw.push({
          t: readU8ms(view, p),
          forward: view.getFloat32(p + 8, true) * MS_PER_KNOT,
          horizontal: view.getFloat32(p + 12, true) * MS_PER_KNOT,
        });
        break;
      }
      default:
        break; // known size, no decoding needed (declination, depth, temp, internal…)
    }

    pos = p + size;
  }

  track.samples.sort((a, b) => a.t - b.t);
  return track;
}

// U8 millisecond timestamps comfortably fit in a JS number until year 287396.
function readU8ms(view: DataView, offset: number): number {
  return Number(view.getBigUint64(offset, true));
}
