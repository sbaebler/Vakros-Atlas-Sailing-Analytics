import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import { Sample } from '../parse/types';

interface Props {
  samples: Sample[];
  onCursor?: (idx: number | null) => void;
  focus?: { start: number; end: number } | null; // zoom to a sample-index range
}

export function TimeSeries({ samples, onCursor, focus }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;

  useEffect(() => {
    if (!elRef.current || samples.length === 0) return;
    const t0 = samples[0].t;
    const xs = samples.map((s) => (s.t - t0) / 1000);
    const sog = samples.map((s) => s.sog);
    const heel = samples.map((s) => s.heel);
    const vmg = samples.map((s) => s.vmg ?? null);

    const data: uPlot.AlignedData = [xs, sog, vmg, heel];

    // Series colors are palette-validated against the panel surface #16293a
    // (CVD ΔE 32.1, all ≥3:1) — see styles.css --series-* tokens.
    const GRID = 'rgba(148, 186, 220, 0.10)';
    const TICK = 'rgba(148, 186, 220, 0.22)';
    const INK = '#8fa6ba';
    const opts: uPlot.Options = {
      width: elRef.current.clientWidth,
      height: 270,
      cursor: {
        drag: { x: true, y: false },
        points: { size: 7, width: 2, fill: '#16293a' },
      },
      scales: { x: { time: false }, kt: {}, heel: {} },
      axes: [
        { stroke: INK, grid: { stroke: GRID }, ticks: { stroke: TICK } },
        {
          scale: 'kt',
          stroke: INK,
          grid: { stroke: GRID },
          ticks: { stroke: TICK },
        },
        {
          side: 1,
          scale: 'heel',
          stroke: INK,
          grid: { show: false },
          ticks: { stroke: TICK },
        },
      ],
      series: [
        { label: 't (s)' },
        { label: 'SOG', stroke: '#1f9fc7', width: 2, scale: 'kt' },
        { label: 'VMG', stroke: '#29ad70', width: 2, scale: 'kt' },
        { label: 'Heel', stroke: '#bf8120', width: 1.5, scale: 'heel' },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            onCursorRef.current?.(idx ?? null);
          },
        ],
      },
    } as uPlot.Options;

    const plot = new uPlot(opts, data, elRef.current);
    plotRef.current = plot;
    const onResize = () => plot.setSize({ width: elRef.current!.clientWidth, height: 270 });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      plot.destroy();
      plotRef.current = null;
    };
  }, [samples]);

  // External focus -> set x zoom.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || samples.length === 0) return;
    const t0 = samples[0].t;
    if (focus && focus.end > focus.start) {
      plot.setScale('x', {
        min: (samples[focus.start].t - t0) / 1000,
        max: (samples[focus.end].t - t0) / 1000,
      });
    } else {
      plot.setScale('x', {
        min: 0,
        max: (samples[samples.length - 1].t - t0) / 1000,
      });
    }
  }, [focus, samples]);

  return <div className="chart" ref={elRef} />;
}
