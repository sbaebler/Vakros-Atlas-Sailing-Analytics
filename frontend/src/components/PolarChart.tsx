import { Polar, optimalVmg, polarTargetSpeed } from '../analysis/polar';

interface Props {
  polar: Polar;
  tws: number; // wind speed to render the curve for
  actual?: { twa: number; sog: number }[]; // optional measured points (abs twa)
  size?: number;
}

// Half-polar: 0° (head to wind) at top, 180° (dead run) at bottom, boat speed as radius.
export function PolarChart({ polar, tws, actual, size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const maxSpeed = Math.max(
    1,
    ...polar.speeds.flat(),
    ...(actual?.map((a) => a.sog) ?? []),
  );
  const R = size / 2 - 24;
  const rad = (v: number) => (v / maxSpeed) * R;
  const pt = (twa: number, speed: number) => {
    const a = ((twa - 90) * Math.PI) / 180; // 0° -> up
    return [cx + Math.cos(a) * rad(speed), cy + Math.sin(a) * rad(speed)];
  };

  const curve: string = polar.twaValues
    .map((twa, i) => {
      const [x, y] = pt(twa, polarTargetSpeed(polar, twa, tws));
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1].map((f) => f * maxSpeed);
  const { upwind, downwind } = optimalVmg(polar, tws);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={rad(s)}
          fill="none"
          stroke="#274156"
          strokeWidth={1}
        />
      ))}
      {[0, 30, 45, 60, 90, 120, 135, 150, 180].map((twa) => {
        const [x, y] = pt(twa, maxSpeed);
        return (
          <g key={twa}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#1d3346" strokeWidth={1} />
            <text x={x} y={y} fill="#93a7b8" fontSize={10} textAnchor="middle">
              {twa}°
            </text>
          </g>
        );
      })}
      {/* target polar curve */}
      <path d={curve} fill="none" stroke="#37c0e6" strokeWidth={2} />
      {/* optimal VMG angles */}
      {[upwind, downwind].map((v, i) => {
        const [x, y] = pt(v.twa, v.boatSpeed);
        return <circle key={i} cx={x} cy={y} r={4} fill="#4ad991" />;
      })}
      {/* actual measured points */}
      {actual?.map((a, i) => {
        const [x, y] = pt(Math.abs(a.twa), a.sog);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="#f2b24b" opacity={0.7} />;
      })}
      <text x={cx} y={14} fill="#e6eef5" fontSize={12} textAnchor="middle">
        {tws} kt TWS
      </text>
    </svg>
  );
}
