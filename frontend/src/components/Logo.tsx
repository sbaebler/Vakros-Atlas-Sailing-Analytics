// Brand mark: a stylized sail + hull, drawn in the accent + ink tones.
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.5 2c4 3.6 6.3 8 6.6 12.5H12.5Z" fill="var(--accent)" />
      <path d="M11 5.5c-2.6 2.6-4.3 5.9-4.9 9H11Z" fill="var(--muted)" />
      <path d="M3.5 16.5h17L18 20H6Z" fill="var(--text)" />
    </svg>
  );
}

// Decorative compass rose for the login backdrop.
export function CompassRose({ size = 520 }: { size?: number }) {
  const c = 100;
  const petal = (angle: number, len: number, w: number) => {
    const a = (angle * Math.PI) / 180;
    const px = c + Math.sin(a) * len;
    const py = c - Math.cos(a) * len;
    const lx = c + Math.sin(a - Math.PI / 2) * w;
    const ly = c - Math.cos(a - Math.PI / 2) * w;
    const rx = c + Math.sin(a + Math.PI / 2) * w;
    const ry = c - Math.cos(a + Math.PI / 2) * w;
    return `M${px},${py} L${lx},${ly} L${rx},${ry} Z`;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx={c} cy={c} r={86} fill="none" stroke="currentColor" strokeWidth={0.7} />
      <circle cx={c} cy={c} r={62} fill="none" stroke="currentColor" strokeWidth={0.4} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d={petal(a, 84, 7)} fill="currentColor" opacity={0.9} />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d={petal(a, 56, 5)} fill="currentColor" opacity={0.55} />
      ))}
      <circle cx={c} cy={c} r={6} fill="currentColor" />
    </svg>
  );
}
