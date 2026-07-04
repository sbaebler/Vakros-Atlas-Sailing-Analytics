import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, SessionSummary } from '../api/client';
import { dateStr, duration, kt, nm } from '../format';

export function Dashboard() {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api.listSessions().then(setSessions).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row between">
        <h1>Sessions</h1>
        <Link to="/import">
          <button className="primary">+ Session importieren</button>
        </Link>
      </div>
      {error && <div className="error">{error}</div>}
      {sessions && sessions.length === 0 && (
        <div className="panel muted">
          Noch keine Sessions. <Link to="/import">Importiere</Link> eine .vkx- oder
          .csv-Aufnahme deines Vakaros Atlas 2.
        </div>
      )}
      {sessions && sessions.length > 0 && (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl-sessions">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Name</th>
                <th>Boot</th>
                <th>Dauer</th>
                <th>Distanz</th>
                <th>Max Speed</th>
                <th>Wenden/Halsen</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="clickable"
                  onClick={() => nav(`/sessions/${s.id}`)}
                >
                  <td>{dateStr(s.sailed_at ?? s.created_at)}</td>
                  <td>{s.name}</td>
                  <td>
                    {s.boat_name ?? <span className="muted">–</span>}
                    {s.boat_class ? <span className="muted"> · {s.boat_class}</span> : null}
                  </td>
                  <td>{duration(s.duration_s)}</td>
                  <td>{nm(s.stats?.distanceNm)}</td>
                  <td>{kt(s.stats?.maxSog)}</td>
                  <td>
                    {s.stats ? `${s.stats.numTacks} / ${s.stats.numGybes}` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
