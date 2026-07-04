import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Boat } from '../api/client';
import { Sample } from '../parse/types';
import { analyze, Analysis } from '../analysis/analyze';
import { Polar } from '../analysis/polar';
import { TrackMap } from '../components/TrackMap';
import { TimeSeries } from '../components/TimeSeries';
import { PolarChart } from '../components/PolarChart';
import { clock, deg, duration, kt, m, nm, pct } from '../format';

interface Range {
  start: number;
  end: number;
}

export function SessionView() {
  const { id } = useParams();
  const sid = Number(id);
  const [meta, setMeta] = useState<any>(null);
  const [samples, setSamples] = useState<Sample[] | null>(null);
  const [polar, setPolar] = useState<Polar | null>(null);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatBusy, setBoatBusy] = useState(false);
  const [error, setError] = useState('');
  const [sel, setSel] = useState<{ range: Range; label: string } | null>(null);
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.getSession(sid);
        setMeta(s);
        if (s.boat_id) {
          const ps = await api.listPolars(s.boat_id);
          setPolar(ps[0]?.data ?? null);
        }
        setSamples(await api.getSessionTrack(sid));
        setBoats(await api.listBoats());
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [sid]);

  async function assignBoat(boatIdRaw: string) {
    const boatId = boatIdRaw === '' ? null : Number(boatIdRaw);
    setBoatBusy(true);
    try {
      await api.updateSession(sid, { boat_id: boatId });
      const boat = boats.find((b) => b.id === boatId);
      setMeta((m: any) => ({
        ...m,
        boat_id: boatId,
        boat_name: boat?.name ?? null,
        boat_class: boat?.boat_class ?? null,
      }));
      if (boatId) {
        const ps = await api.listPolars(boatId);
        setPolar(ps[0]?.data ?? null);
      } else {
        setPolar(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBoatBusy(false);
    }
  }

  const analysis: Analysis | null = useMemo(() => {
    if (!samples) return null;
    const wm = meta?.wind_meta;
    return analyze({
      source: (meta?.source_format ?? 'vkx') as any,
      samples,
      raceTimer: [],
      lines: [],
      shifts: [],
      wind: [],
      stw: [],
      get hasWind() {
        return false;
      },
      get hasStw() {
        return false;
      },
    }, {
      polar,
      wind: wm
        ? { mode: wm.manual ? 'manual' : 'auto', twd: wm.twd, tws: wm.tws }
        : {},
      start: meta?.analysis?.start?.line
        ? { line: meta.analysis.start.line, gunTime: meta.analysis.start.gunTime }
        : {},
    });
  }, [samples, meta, polar]);

  if (error) return <div className="error">{error}</div>;
  if (!meta || !samples || !analysis) return <div className="spinner">Lädt…</div>;

  const st = analysis.stats;
  const actualPts = analysis.legs
    .filter((l) => l.avgSog > 1)
    .map((l) => ({ twa: l.avgTwa, sog: l.avgSog }));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between wrap">
        <div>
          <h1 style={{ marginBottom: 2 }}>{meta.name}</h1>
          <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
            <span className="muted">Boot</span>
            <select
              value={meta.boat_id ?? ''}
              disabled={boatBusy}
              onChange={(e) => assignBoat(e.target.value)}
            >
              <option value="">– kein Boot –</option>
              {boats.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.boat_class ? `(${b.boat_class})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="muted">
            {clock(samples[0].t)}–{clock(samples[samples.length - 1].t)} ·{' '}
            Wind {deg(st.twd)} / {st.tws.toFixed(0)} kt ({st.windSource})
          </div>
        </div>
        <Link to="/">
          <button>← Sessions</button>
        </Link>
      </div>

      <div className="stats">
        <Stat v={duration(st.durationSec)} l="Dauer" />
        <Stat v={nm(st.distanceNm)} l="Distanz" />
        <Stat v={kt(st.maxSog)} l="Max Speed" />
        <Stat v={kt(st.avgSog)} l="Ø Speed" />
        <Stat v={String(st.numTacks)} l="Wenden" />
        <Stat v={String(st.numGybes)} l="Halsen" />
      </div>

      <div className="session-grid">
        <div className="grid" style={{ gap: 10 }}>
          <TrackMap
            samples={samples}
            highlight={sel?.range}
            cursorIdx={cursorIdx}
            line={analysis.start.line}
          />
          <div className="panel">
            <TimeSeries
              samples={samples}
              onCursor={setCursorIdx}
              focus={sel?.range}
            />
            {sel && (
              <div className="row between" style={{ marginTop: 8 }}>
                <span className="muted">Fokus: {sel.label}</span>
                <button onClick={() => setSel(null)}>Ganze Session</button>
              </div>
            )}
          </div>
        </div>

        <div className="grid" style={{ gap: 12 }}>
          {analysis.start.line && analysis.start.gunTime && (
            <StartPanel analysis={analysis} />
          )}

          {polar && (
            <div className="panel">
              <h2>Polar-Vergleich</h2>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <PolarChart polar={polar} tws={Math.round(st.tws)} actual={actualPts} />
              </div>
            </div>
          )}
          {!polar && (
            <div className="panel muted">
              Kein Polar hinterlegt. Weise diesem Boot ein{' '}
              <Link to="/boats">Polar</Link> zu, um % vom Ziel-Speed zu sehen.
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px' }}>
          <h2 style={{ margin: 0 }}>Schläge</h2>
        </div>
        <table className="tbl-legs">
          <thead>
            <tr>
              <th>#</th>
              <th>Zeit</th>
              <th>Art</th>
              <th>Tack</th>
              <th>TWA</th>
              <th>Ø SOG</th>
              <th>Ø VMG</th>
              <th>Ø Heel</th>
              <th>Kurs σ</th>
              <th>% Polar</th>
            </tr>
          </thead>
          <tbody>
            {analysis.legs.map((l, i) => (
              <tr
                key={i}
                className={`clickable ${
                  sel?.range.start === l.startIdx ? 'selected' : ''
                }`}
                onClick={() =>
                  setSel({
                    range: { start: l.startIdx, end: l.endIdx },
                    label: `Schlag ${i + 1} (${l.pointOfSail})`,
                  })
                }
              >
                <td>{i + 1}</td>
                <td>{clock(l.tStart)}</td>
                <td>
                  <span className={`badge ${l.pointOfSail}`}>{l.pointOfSail}</span>
                </td>
                <td>{l.tack === 'port' ? 'BB' : 'STB'}</td>
                <td>{deg(l.avgTwa)}</td>
                <td>{kt(l.avgSog)}</td>
                <td>{kt(l.avgVmg)}</td>
                <td>{deg(l.avgHeel)}</td>
                <td>{l.headingStdDev.toFixed(1)}°</td>
                <td>
                  {l.percentPolar != null ? (
                    <span className={`meter ${l.percentPolar >= 100 ? 'hot' : ''}`}>
                      {pct(l.percentPolar)}
                      <i>
                        <b
                          style={{
                            width: `${Math.min(100, (l.percentPolar / 120) * 100)}%`,
                          }}
                        />
                      </i>
                    </span>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px' }}>
          <h2 style={{ margin: 0 }}>Manöver</h2>
        </div>
        <table className="tbl-maneuvers">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Art</th>
              <th>Drehung</th>
              <th>Eintritt</th>
              <th>Min</th>
              <th>Austritt</th>
              <th>Speed-Verlust</th>
              <th>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {analysis.maneuvers.map((mv, i) => (
              <tr
                key={i}
                className="clickable"
                onClick={() =>
                  setSel({
                    range: { start: Math.max(0, mv.idx - 30), end: mv.idx + 30 },
                    label: `${mv.type} @ ${clock(mv.t)}`,
                  })
                }
              >
                <td>{clock(mv.t)}</td>
                <td>
                  <span className={`badge ${mv.type}`}>{mv.type}</span>
                </td>
                <td>{Math.abs(Math.round(mv.turn))}°</td>
                <td>{kt(mv.entrySog)}</td>
                <td>{kt(mv.minSog)}</td>
                <td>{kt(mv.exitSog)}</td>
                <td>{kt(mv.entrySog - mv.minSog)}</td>
                <td>{mv.recoverySec.toFixed(1)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StartPanel({ analysis }: { analysis: Analysis }) {
  const s = analysis.start;
  return (
    <div className="panel grid" style={{ gap: 10 }}>
      <h2 style={{ margin: 0 }}>Start</h2>
      <div className="stats">
        <Stat v={s.gunTime ? clock(s.gunTime) : '–'} l="Startschuss" />
        <Stat
          v={s.distanceToLineM != null ? m(Math.abs(s.distanceToLineM)) : '–'}
          l={s.side === 'over' ? 'über früh' : 'hinter Linie'}
        />
        <Stat v={kt(s.speedAtGunKts)} l="Speed @ Gun" />
        <Stat
          v={s.timeToLineSec != null ? `${s.timeToLineSec.toFixed(0)} s` : '–'}
          l="Zeit zur Linie"
        />
        <Stat v={s.lineLengthM != null ? m(s.lineLengthM) : '–'} l="Linienlänge" />
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
