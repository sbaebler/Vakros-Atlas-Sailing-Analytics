import { useEffect, useMemo, useRef } from 'react';
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

// Sequential single-hue ramp (cyan, dark→light) for magnitude on the dark basemap:
// dim = slow recedes into the chart, bright = fast pops. One hue only — no rainbow.
const RAMP = ['#17475c', '#1d6480', '#1f89ad', '#2fb2d9', '#45cdf1', '#8ae2f8', '#b7ecfb'];

function speedColor(f: number): string {
  const x = Math.max(0, Math.min(0.999, f)) * (RAMP.length - 1);
  const i = Math.floor(x);
  return mix(RAMP[i], RAMP[i + 1], x - i);
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
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const cursorRef = useRef<L.CircleMarker | null>(null);
  const haloRef = useRef<L.CircleMarker | null>(null);

  const maxValue = useMemo(() => {
    const values = samples.map((s) => (colorBy === 'vmg' ? Math.abs(s.vmg ?? 0) : s.sog));
    return Math.max(1, ...values);
  }, [samples, colorBy]);

  // Init map + colored track once per sample set.
  useEffect(() => {
    if (!elRef.current || samples.length === 0) return;
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    map.attributionControl.setPrefix(false);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const values = samples.map((s) =>
      colorBy === 'vmg' ? Math.abs(s.vmg ?? 0) : s.sog,
    );

    const group = L.layerGroup().addTo(map);
    // Soft underglow beneath the whole track so it lifts off the basemap.
    L.polyline(
      samples.map((s) => [s.lat, s.lon] as L.LatLngExpression),
      { color: '#0a3242', weight: 7, opacity: 0.55, interactive: false },
    ).addTo(group);
    // Group consecutive points sharing a colour bucket into polylines.
    let seg: L.LatLngExpression[] = [samples[0] && [samples[0].lat, samples[0].lon]];
    let curBucket = -1;
    const bucketOf = (v: number) => Math.round((v / maxValue) * 12);
    for (let i = 0; i < samples.length; i++) {
      const b = bucketOf(values[i]);
      const ll: L.LatLngExpression = [samples[i].lat, samples[i].lon];
      if (b !== curBucket && seg.length > 1) {
        L.polyline(seg, {
          color: speedColor(curBucket / 12),
          weight: 3,
          interactive: false,
        }).addTo(group);
        seg = [seg[seg.length - 1]];
      }
      seg.push(ll);
      curBucket = b;
    }
    if (seg.length > 1) {
      L.polyline(seg, {
        color: speedColor(curBucket / 12),
        weight: 3,
        interactive: false,
      }).addTo(group);
    }

    const bounds = L.latLngBounds(samples.map((s) => [s.lat, s.lon]));
    map.fitBounds(bounds, { padding: [24, 24] });

    overlayRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [samples, colorBy, maxValue]);

  // Highlight range + start line overlay.
  useEffect(() => {
    const ov = overlayRef.current;
    if (!ov) return;
    ov.clearLayers();
    if (highlight && highlight.end > highlight.start) {
      const pts = samples
        .slice(highlight.start, highlight.end + 1)
        .map((s) => [s.lat, s.lon] as L.LatLngExpression);
      // 2px surface ring around the highlight so it separates from the track.
      L.polyline(pts, { color: '#0a1520', weight: 9, opacity: 0.85 }).addTo(ov);
      L.polyline(pts, { color: '#ffffff', weight: 5, opacity: 0.95 }).addTo(ov);
    }
    if (line) {
      L.polyline(
        [
          [line.pin.lat, line.pin.lon],
          [line.boat.lat, line.boat.lon],
        ],
        { color: '#f2b24b', weight: 2.5, dashArray: '7 6' },
      ).addTo(ov);
      L.circleMarker([line.pin.lat, line.pin.lon], {
        radius: 5,
        color: '#f2b24b',
        fillColor: '#0a1520',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip('Pin')
        .addTo(ov);
      L.circleMarker([line.boat.lat, line.boat.lon], {
        radius: 5,
        color: '#f2b24b',
        fillColor: '#0a1520',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip('Boot/Committee')
        .addTo(ov);
    }
  }, [highlight, line, samples]);

  // Cursor marker synced from the charts: bright dot + soft halo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (cursorIdx == null || !samples[cursorIdx]) {
      cursorRef.current?.remove();
      haloRef.current?.remove();
      cursorRef.current = null;
      haloRef.current = null;
      return;
    }
    const s = samples[cursorIdx];
    const ll: L.LatLngExpression = [s.lat, s.lon];
    if (!cursorRef.current) {
      haloRef.current = L.circleMarker(ll, {
        radius: 13,
        stroke: false,
        fillColor: '#45cdf1',
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(map);
      cursorRef.current = L.circleMarker(ll, {
        radius: 6,
        color: '#ffffff',
        fillColor: '#45cdf1',
        fillOpacity: 1,
        weight: 2,
        interactive: false,
      }).addTo(map);
    } else {
      cursorRef.current.setLatLng(ll);
      haloRef.current?.setLatLng(ll);
    }
  }, [cursorIdx, samples]);

  return (
    <div className="map-wrap">
      <div className="map" ref={elRef} />
      <div className="map-legend">
        <span>0</span>
        <i />
        <span>
          {maxValue.toFixed(1)} kt {colorBy === 'vmg' ? 'VMG' : 'SOG'}
        </span>
      </div>
    </div>
  );
}
