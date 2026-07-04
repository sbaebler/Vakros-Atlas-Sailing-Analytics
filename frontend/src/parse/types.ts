// Unified data model shared by the VKX and CSV parsers and the analysis engine.
// Angles are degrees, speeds are knots, timestamps are Unix milliseconds UTC.

export const MS_PER_KNOT = 1.9438444924406; // m/s -> knots

/** One normalized telemetry sample (from a `0x02` PVO row or a CSV line). */
export interface Sample {
  t: number; // Unix ms UTC
  lat: number; // degrees
  lon: number; // degrees
  sog: number; // knots
  cog: number; // degrees, 0..360
  hdg: number; // true heading degrees, 0..360
  heel: number; // roll degrees, positive = starboard rail down
  trim: number; // pitch degrees, positive = bow up
  alt?: number; // metres
  // Filled in later by the analysis engine (wind model / polar):
  twd?: number; // true wind direction, degrees
  tws?: number; // true wind speed, knots
  twa?: number; // true wind angle, -180..180 (negative = port)
  vmg?: number; // velocity made good toward/away from wind, knots
  targetSog?: number; // polar target boat speed at this twa/tws, knots
}

export interface RaceTimerEvent {
  t: number;
  type: number; // 0 RESET, 1 START, 2 SYNC, 3 RACE_START, 4 RACE_END
  timer: number; // seconds
}

export interface LinePing {
  t: number;
  end: 0 | 1; // 0 = pin (left), 1 = boat (right)
  lat: number;
  lon: number;
}

export interface ShiftAngle {
  t: number;
  tack: 0 | 1; // 0 = starboard, 1 = port
  manual: boolean;
  heading: number; // true heading, degrees
  sog: number; // knots
}

/** Apparent wind reading from an attached sensor (Calypso). */
export interface WindReading {
  t: number;
  awd: number; // apparent wind direction, degrees
  aws: number; // apparent wind speed, knots
}

export interface StwReading {
  t: number;
  forward: number; // knots
  horizontal: number; // knots
}

export interface ParsedTrack {
  source: 'vkx' | 'csv';
  formatVersion?: number;
  loggingRateHz?: number;
  samples: Sample[];
  raceTimer: RaceTimerEvent[];
  lines: LinePing[];
  shifts: ShiftAngle[];
  wind: WindReading[]; // apparent wind, empty if no sensor
  stw: StwReading[];
  get hasWind(): boolean;
  get hasStw(): boolean;
}

export function emptyTrack(source: 'vkx' | 'csv'): ParsedTrack {
  return {
    source,
    samples: [],
    raceTimer: [],
    lines: [],
    shifts: [],
    wind: [],
    stw: [],
    get hasWind() {
      return this.wind.length > 0;
    },
    get hasStw() {
      return this.stw.length > 0;
    },
  };
}
