import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, Boat, PolarRecord } from '../api/client';
import { parseFile } from '../parse/parseFile';
import { ParsedTrack } from '../parse/types';
import { analyze } from '../analysis/analyze';
import { TrackMap } from '../components/TrackMap';
import { duration, kt, nm, deg } from '../format';

export function Import() {
  const nav = useNavigate();
  const [track, setTrack] = useState<ParsedTrack | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatId, setBoatId] = useState<number | null>(null);
  const [polars, setPolars] = useState<PolarRecord[]>([]);
  const [polarId, setPolarId] = useState<number | null>(null);

  // Wind controls (hybrid): estimate is the starting point, user can override.
  const [twd, setTwd] = useState<number>(0);
  const [tws, setTws] = useState<number>(12);
  const [windTouched, setWindTouched] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    api.listBoats().then(setBoats).catch(() => {});
  }, []);

  useEffect(() => {
    if (boatId == null) {
      setPolars([]);
      setPolarId(null);
      return;
    }
    api.listPolars(boatId).then((p) => {
      setPolars(p);
      setPolarId(p[0]?.id ?? null);
    });
  }, [boatId]);

  const polar = polars.find((p) => p.id === polarId)?.data ?? null;

  // Re-run analysis whenever inputs change.
  const analysis = useMemo(() => {
    if (!track) return null;
    return analyze(track, {
      polar,
      wind: windTouched ? { mode: 'manual', twd, tws } : { tws },
    });
  }, [track, polar, twd, tws, windTouched]);

  // Seed the TWD control from the first estimate.
  useEffect(() => {
    if (track && !windTouched && analysis) setTwd(Math.round(analysis.stats.twd));
  }, [track, analysis, windTouched]);

  async function onFile(file: File) {
    setError('');
    setBusy(true);
    try {
      const t = await parseFile(file);
      if (t.samples.length === 0) throw new Error('Keine Datenpunkte in der Datei.');
      setTrack(t);
      setName(file.name.replace(/\.(vkx|csv)$/i, ''));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!track || !analysis) return;
    setBusy(true);
    setError('');
    try {
      const { id } = await api.createSession({
        name,
        boat_id: boatId,
        sailed_at: new Date(track.samples[0].t).toISOString().slice(0, 19).replace('T', ' '),
        source_format: track.source,
        duration_s: Math.round(analysis.stats.durationSec),
        stats: analysis.stats,
        wind_meta: { source: analysis.wind.source, twd, tws, manual: windTouched },
        analysis: {
          legs: analysis.legs,
          maneuvers: analysis.maneuvers,
          start: analysis.start,
        },
        samples: track.samples,
      });
      nav(`/sessions/${id}`);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (!track) {
    return (
      <div className="grid" style={{ gap: 16 }}>
        <h1>Session importieren</h1>
        <label
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept=".vkx,.csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <div style={{ fontSize: 16 }}>
            {busy ? 'Verarbeite…' : 'Datei hierher ziehen oder klicken'}
          </div>
          <div>.vkx (voller Umfang) oder .csv-Export vom Vakaros Atlas 2</div>
        </label>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  const st = analysis!.stats;
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between">
        <h1>Import vorbereiten</h1>
        <button onClick={() => setTrack(null)}>Andere Datei</button>
      </div>

      <div className="session-grid">
        <TrackMap samples={track.samples} />
        <div className="grid" style={{ gap: 12 }}>
          <div className="panel grid" style={{ gap: 10 }}>
            <label className="grid" style={{ gap: 4 }}>
              <span className="muted">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="grid" style={{ gap: 4 }}>
              <span className="muted">Boot (Typ-Metadatum & Polar)</span>
              <select
                value={boatId ?? ''}
                onChange={(e) => setBoatId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">– kein Boot –</option>
                {boats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.boat_class ? `(${b.boat_class})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {polars.length > 0 && (
              <label className="grid" style={{ gap: 4 }}>
                <span className="muted">Polar</span>
                <select
                  value={polarId ?? ''}
                  onChange={(e) => setPolarId(Number(e.target.value))}
                >
                  {polars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="panel grid" style={{ gap: 10 }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>Wind</h2>
              <span className="muted">
                Quelle: {windTouched ? 'manuell' : analysis!.wind.source}
              </span>
            </div>
            <div className="row wrap">
              <label className="grid" style={{ gap: 4 }}>
                <span className="muted">TWD (Richtung)</span>
                <input
                  type="number"
                  value={twd}
                  onChange={(e) => {
                    setWindTouched(true);
                    setTwd(Number(e.target.value));
                  }}
                  style={{ width: 90 }}
                />
              </label>
              <label className="grid" style={{ gap: 4 }}>
                <span className="muted">TWS (Stärke, kt)</span>
                <input
                  type="number"
                  value={tws}
                  onChange={(e) => setTws(Number(e.target.value))}
                  style={{ width: 90 }}
                />
              </label>
            </div>
            {track.source === 'csv' && (
              <div className="muted" style={{ fontSize: 12 }}>
                CSV enthält keine Wind-/Startlinien-Daten – TWD wird aus dem Track
                geschätzt, bitte prüfen.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat v={duration(st.durationSec)} l="Dauer" />
        <Stat v={nm(st.distanceNm)} l="Distanz" />
        <Stat v={kt(st.maxSog)} l="Max Speed" />
        <Stat v={String(st.numTacks)} l="Wenden" />
        <Stat v={String(st.numGybes)} l="Halsen" />
        <Stat v={deg(st.twd)} l="TWD" />
      </div>

      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary" onClick={save} disabled={busy || !name}>
          {busy ? 'Speichert…' : 'Session speichern'}
        </button>
      </div>
    </div>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}
