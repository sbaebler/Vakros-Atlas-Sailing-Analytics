import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Boat, PolarRecord } from '../api/client';

export function BoatManager() {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [polars, setPolars] = useState<Record<number, PolarRecord[]>>({});
  const [editing, setEditing] = useState<Partial<Boat> | null>(null);
  const [error, setError] = useState('');

  async function reload() {
    const list = await api.listBoats();
    setBoats(list);
    const map: Record<number, PolarRecord[]> = {};
    await Promise.all(
      list.map(async (b) => {
        map[b.id] = await api.listPolars(b.id);
      }),
    );
    setPolars(map);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);

  async function save() {
    if (!editing) return;
    try {
      if (editing.id) await api.updateBoat(editing.id, editing);
      else await api.createBoat(editing);
      setEditing(null);
      await reload();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function del(id: number) {
    if (!confirm('Boot und zugehörige Polaren löschen?')) return;
    await api.deleteBoat(id);
    await reload();
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="row between">
        <h1>Boote</h1>
        <button
          className="primary"
          onClick={() => setEditing({ name: '', boat_class: '', sail_number: '' })}
        >
          + Boot
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      {editing && (
        <div className="panel grid" style={{ gap: 10, maxWidth: 520 }}>
          <h2>{editing.id ? 'Boot bearbeiten' : 'Neues Boot'}</h2>
          <Field label="Name">
            <input
              value={editing.name ?? ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </Field>
          <Field label="Bootstyp / Klasse">
            <input
              placeholder="z. B. Lüthi 990, J/70, ORC…"
              value={editing.boat_class ?? ''}
              onChange={(e) => setEditing({ ...editing, boat_class: e.target.value })}
            />
          </Field>
          <Field label="Segelnummer">
            <input
              value={editing.sail_number ?? ''}
              onChange={(e) => setEditing({ ...editing, sail_number: e.target.value })}
            />
          </Field>
          <div className="row">
            <button className="primary" onClick={save}>
              Speichern
            </button>
            <button onClick={() => setEditing(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="grid cards">
        {boats.map((b) => (
          <div className="card grid" key={b.id} style={{ gap: 8 }}>
            <div className="row between">
              <strong>{b.name}</strong>
              <span className="muted">{b.sail_number}</span>
            </div>
            <div className="muted">{b.boat_class || 'Kein Typ hinterlegt'}</div>
            <div className="grid" style={{ gap: 4 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Polaren
              </div>
              {(polars[b.id] ?? []).map((p) => (
                <Link key={p.id} to={`/boats/${b.id}/polar/${p.id}`}>
                  {p.name}
                </Link>
              ))}
              <Link to={`/boats/${b.id}/polar/new`}>+ Polar hinzufügen</Link>
            </div>
            <div className="row">
              <button onClick={() => setEditing(b)}>Bearbeiten</button>
              <button className="danger" onClick={() => del(b.id)}>
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid" style={{ gap: 4 }}>
      <span className="muted">{label}</span>
      {children}
    </label>
  );
}
