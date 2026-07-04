import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { defaultKeelboatPolar, Polar } from '../analysis/polar';
import { parsePolarCsv } from '../analysis/polarCsv';
import { PolarChart } from '../components/PolarChart';

export function PolarEditor() {
  const { boatId, polarId } = useParams();
  const bId = Number(boatId);
  const nav = useNavigate();
  const isNew = !polarId || polarId === 'new';

  const [name, setName] = useState('Polar');
  const [polar, setPolar] = useState<Polar>(defaultKeelboatPolar());
  const [source, setSource] = useState('manual');
  const [previewTws, setPreviewTws] = useState(12);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    api.listPolars(bId).then((ps) => {
      const p = ps.find((x) => x.id === Number(polarId));
      if (p) {
        setName(p.name);
        setPolar(p.data);
        setSource(p.source || 'manual');
      }
    });
  }, [bId, polarId, isNew]);

  function setSpeed(ti: number, si: number, v: number) {
    const speeds = polar.speeds.map((row) => row.slice());
    speeds[ti][si] = v;
    setPolar({ ...polar, speeds });
  }
  function setTws(si: number, v: number) {
    const twsValues = polar.twsValues.slice();
    twsValues[si] = v;
    setPolar({ ...polar, twsValues });
  }
  function setTwa(ti: number, v: number) {
    const twaValues = polar.twaValues.slice();
    twaValues[ti] = v;
    setPolar({ ...polar, twaValues });
  }

  async function importCsv(file: File) {
    setError('');
    try {
      const text = await file.text();
      const imported = parsePolarCsv(text, file.name.replace(/\.csv$/i, ''));
      setPolar(imported);
      setName(imported.name);
      setSource(`csv:${file.name}`);
    } catch (e: any) {
      setError(`CSV-Import fehlgeschlagen: ${e.message}`);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const body = { name, source, data: polar };
      if (isNew) await api.createPolar(bId, body);
      else await api.updatePolar(Number(polarId), body);
      nav('/boats');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function del() {
    if (isNew || !confirm('Polar löschen?')) return;
    await api.deletePolar(Number(polarId));
    nav('/boats');
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row between">
        <h1>Polar {isNew ? 'anlegen' : 'bearbeiten'}</h1>
        <button onClick={() => nav('/boats')}>← Boote</button>
      </div>

      <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="panel" style={{ overflowX: 'auto' }}>
          <label className="grid" style={{ gap: 4, marginBottom: 10 }}>
            <span className="muted">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="row" style={{ gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <button type="button" onClick={() => fileInput.current?.click()}>
              CSV importieren
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importCsv(file);
              }}
            />
            <span className="muted" style={{ fontSize: 12 }}>
              z.B. ORC-Polar-Export von windregatta.com (twa/tws;4;6;8...)
            </span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Ziel-Bootsgeschwindigkeit (kt) je TWA (Zeile) × TWS (Spalte)
          </div>
          <table className="polar-grid">
            <thead>
              <tr>
                <th>TWA \ TWS</th>
                {polar.twsValues.map((tws, si) => (
                  <th key={si}>
                    <input
                      value={tws}
                      onChange={(e) => setTws(si, Number(e.target.value))}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {polar.twaValues.map((twa, ti) => (
                <tr key={ti}>
                  <th>
                    <input
                      value={twa}
                      onChange={(e) => setTwa(ti, Number(e.target.value))}
                    />
                  </th>
                  {polar.twsValues.map((_, si) => (
                    <td key={si}>
                      <input
                        value={polar.speeds[ti]?.[si] ?? 0}
                        onChange={(e) => setSpeed(ti, si, Number(e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel grid" style={{ gap: 10 }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>Vorschau</h2>
            <label className="row" style={{ gap: 6 }}>
              <span className="muted">TWS</span>
              <input
                type="number"
                value={previewTws}
                onChange={(e) => setPreviewTws(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </label>
          </div>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <PolarChart polar={polar} tws={previewTws} />
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary" onClick={save} disabled={busy}>
          Speichern
        </button>
        {!isNew && (
          <button className="danger" onClick={del}>
            Löschen
          </button>
        )}
      </div>
    </div>
  );
}
