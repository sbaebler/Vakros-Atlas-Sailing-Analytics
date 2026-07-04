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

    const opts: uPlot.Options = {
      width: elRef.current.clientWidth,
      height: 260,
      cursor: { drag: { x: true, y: false } },
      scales: { x: { time: false }, kt: {}, heel: {} },
      axes: [
        { stroke: '#93a7b8', grid: { stroke: '#274156' }, ticks: { stroke: '#274156' } },
        {
          scale: 'kt',
          stroke: '#93a7b8',
          grid: { stroke: '#1d3346' },
          ticks: { stroke: '#274156' },
        },
        {
          side: 1,
          scale: 'heel',
          stroke: '#93a7b8',
          grid: { show: false },
          ticks: { stroke: '#274156' },
        },
      ],
      series: [
        { label: 't (s)' },
        { label: 'SOG', stroke: '#37c0e6', width: 1.5, scale: 'kt' },
        { label: 'VMG', stroke: '#4ad991', width: 1.5, scale: 'kt' },
        { label: 'Heel', stroke: '#f2b24b', width: 1, scale: 'heel' },
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
    const onResize = () => plot.setSize({ width: elRef.current!.clientWidth, height: 260 });
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
