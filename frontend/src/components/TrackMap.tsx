import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Sample } from '../parse/types';
import { StartLine } from '../analysis/start';

interface Props {
  samples: Sample[];
  highlight?: { start: number; end: number } | null; // sample index range
  cursorIdx?: number | null;
  line?: StartLine | null;
  colorBy?: 'sog' | 'vmg';
}

// Blue→cyan→green→yellow→red ramp keyed to a normalized 0..1 value.
function speedColor(f: number): string {
  const stops = ['#2b6cb0', '#37c0e6', '#4ad991', '#f2b24b', '#ef6d6d'];
  const x = Math.max(0, Math.min(0.999, f)) * (stops.length - 1);
  const i = Math.floor(x);
  return mix(stops[i], stops[i + 1], x - i);
}
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function TrackMap({ samples, highlight, cursorIdx, line, colorBy = 'sog' }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const cursorRef = useRef<L.CircleMarker | null>(null);

  // Init map + colored track once per sample set.
  useEffect(() => {
    if (!elRef.current || samples.length === 0) return;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: false });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const values = samples.map((s) =>
      colorBy === 'vmg' ? Math.abs(s.vmg ?? 0) : s.sog,
    );
    const max = Math.max(1, ...values);

    const group = L.layerGroup().addTo(map);
    layersRef.current = group;
    // Group consecutive points sharing a colour bucket into polylines.
    let seg: L.LatLngExpression[] = [samples[0] && [samples[0].lat, samples[0].lon]];
    let curBucket = -1;
    const bucketOf = (v: number) => Math.round((v / max) * 12);
    for (let i = 0; i < samples.length; i++) {
      const b = bucketOf(values[i]);
      const ll: L.LatLngExpression = [samples[i].lat, samples[i].lon];
      if (b !== curBucket && seg.length > 1) {
        L.polyline(seg, { color: speedColor(curBucket / 12), weight: 3 }).addTo(group);
        seg = [seg[seg.length - 1]];
      }
      seg.push(ll);
      curBucket = b;
    }
    if (seg.length > 1) {
      L.polyline(seg, { color: speedColor(curBucket / 12), weight: 3 }).addTo(group);
    }

    const bounds = L.latLngBounds(samples.map((s) => [s.lat, s.lon]));
    map.fitBounds(bounds, { padding: [24, 24] });

    overlayRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [samples, colorBy]);

  // Highlight range + start line overlay.
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    ov.clearLayers();
    if (highlight && highlight.end > highlight.start) {
      const pts = samples
        .slice(highlight.start, highlight.end + 1)
        .map((s) => [s.lat, s.lon] as L.LatLngExpression);
      L.polyline(pts, { color: '#ffffff', weight: 5, opacity: 0.9 }).addTo(ov);
    }
    if (line) {
      L.polyline(
        [
          [line.pin.lat, line.pin.lon],
          [line.boat.lat, line.boat.lon],
        ],
        { color: '#f2b24b', weight: 2, dashArray: '6 5' },
      ).addTo(ov);
      L.circleMarker([line.pin.lat, line.pin.lon], { radius: 5, color: '#f2b24b' })
        .bindTooltip('Pin')
        .addTo(ov);
      L.circleMarker([line.boat.lat, line.boat.lon], { radius: 5, color: '#f2b24b' })
        .bindTooltip('Boot/Committee')
        .addTo(ov);
    }
  }, [highlight, line, samples]);

  // Cursor marker synced from the charts.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (cursorIdx == null || !samples[cursorIdx]) {
      cursorRef.current?.remove();
      cursorRef.current = null;
      return;
    }
    const s = samples[cursorIdx];
    if (!cursorRef.current) {
      cursorRef.current = L.circleMarker([s.lat, s.lon], {
        radius: 6,
        color: '#fff',
        fillColor: '#37c0e6',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
    } else {
      cursorRef.current.setLatLng([s.lat, s.lon]);
    }
  }, [cursorIdx, samples]);

  return <div className="map" ref={elRef} />;
}
