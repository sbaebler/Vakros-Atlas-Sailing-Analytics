import { Polar, optimalVmg, polarTargetSpeed } from '../analysis/polar';

interface Props {
  polar: Polar;
  tws: number; // wind speed to render the curve for
  actual?: { twa: number; sog: number }[]; // optional measured points (abs twa)
  size?: number;
}

// Colors are palette-validated against the panel surface #16293a (see styles.css).
const C_TARGET = '#1f9fc7'; // target curve (series 1)
const C_ACTUAL = '#bf8120'; // measured legs (series 2)
const C_VMG = '#29ad70'; // optimal-VMG markers (series 3)
const INK_MUTED = '#8fa6ba';
const INK_FAINT = '#5e7b94';
const RING = 'rgba(148, 186, 220, 0.13)';
const SPOKE = 'rgba(148, 186, 220, 0.08)';
const SURFACE = '#16293a';

// Half-polar: 0° (head to wind) at top, 180° (dead run) at bottom, boat speed as radius.
export function PolarChart({ polar, tws, actual, size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2 - 6;
  const maxSpeed = Math.max(
    1,
    ...polar.speeds.flat(),
    ...(actual?.map((a) => a.sog) ?? []),
  );
  const R = size / 2 - 30;
  const rad = (v: number) => (v / maxSpeed) * R;
  const pt = (twa: number, speed: number) => {
    const a = ((twa - 90) * Math.PI) / 180; // 0° -> up
    return [cx + Math.cos(a) * rad(speed), cy + Math.sin(a) * rad(speed)];
  };

  const curvePts = polar.twaValues.map((twa) => pt(twa, polarTargetSpeed(polar, twa, tws)));
  const curve = curvePts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  // Soft area wash: close the curve back through the centre.
  const area = `${curve} L${cx.toFixed(1)},${cy.toFixed(1)} Z`;

  const rings = [0.25, 0.5, 0.75, 1].map((f) => f * maxSpeed);
  const { upwind, downwind } = optimalVmg(polar, tws);

  return (
    <svg width={size} height={size + 22} viewBox={`0 0 ${size} ${size + 22}`}>
      {rings.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={rad(s)} fill="none" stroke={RING} strokeWidth={1} />
      ))}
      {/* ring value labels along the vertical, in ink — never series color */}
      {rings.slice(1).map((s, i) => (
        <text
          key={i}
          x={cx + 3}
          y={cy - rad(s) + 11}
          fill={INK_FAINT}
          fontSize={9}
          fontVariant="tabular-nums"
        >
          {s.toFixed(1)}
        </text>
      ))}
      {[0, 30, 45, 60, 90, 120, 135, 150, 180].map((twa) => {
        const [x, y] = pt(twa, maxSpeed);
        const [lx, ly] = pt(twa, maxSpeed * 1.1);
        return (
          <g key={twa}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={SPOKE} strokeWidth={1} />
            <text
              x={lx}
              y={ly + 3}
              fill={INK_MUTED}
              fontSize={10}
              textAnchor="middle"
            >
              {twa}°
            </text>
          </g>
        );
      })}
      {/* target polar curve with a soft wash */}
      <path d={area} fill={C_TARGET} opacity={0.09} />
      <path d={curve} fill="none" stroke={C_TARGET} strokeWidth={2} strokeLinejoin="round" />
      {/* actual measured legs — 2px surface ring so overlapping marks separate */}
      {actual?.map((a, i) => {
        const [x, y] = pt(Math.abs(a.twa), a.sog);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3.2}
            fill={C_ACTUAL}
            stroke={SURFACE}
            strokeWidth={1.5}
          />
        );
      })}
      {/* optimal VMG angles */}
      {[upwind, downwind].map((v, i) => {
        const [x, y] = pt(v.twa, v.boatSpeed);
        return (
          <circle key={i} cx={x} cy={y} r={4.5} fill={C_VMG} stroke={SURFACE} strokeWidth={2} />
        );
      })}
      <text x={cx} y={13} fill="#e9f1f7" fontSize={12} fontWeight={700} textAnchor="middle">
        {tws} kt TWS
      </text>
      {/* legend — identity is never color-alone */}
      <g fontSize={10.5} fill={INK_MUTED}>
        <line x1={cx - 118} y1={size + 12} x2={cx - 102} y2={size + 12} stroke={C_TARGET} strokeWidth={2} />
        <text x={cx - 97} y={size + 15.5}>Ziel</text>
        {actual && actual.length > 0 && (
          <>
            <circle cx={cx - 56} cy={size + 12} r={3.2} fill={C_ACTUAL} />
            <text x={cx - 48} y={size + 15.5}>Ist (Schläge)</text>
          </>
        )}
        <circle cx={cx + 34} cy={size + 12} r={4} fill={C_VMG} />
        <text x={cx + 42} y={size + 15.5}>VMG-Optimum</text>
      </g>
    </svg>
  );
}
