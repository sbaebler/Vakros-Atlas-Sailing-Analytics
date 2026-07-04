import { FormEvent, useState } from 'react';
import { useAuth } from '../auth';
import { CompassRose, Logo } from '../components/Logo';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message ?? 'Anmeldung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-rose" style={{ color: 'var(--accent)' }}>
        <CompassRose />
      </div>
      <form className="panel login" onSubmit={submit}>
        <div className="brand-lg">
          <Logo size={26} />
          Atlas&nbsp;<span>Analytics</span>
        </div>
        <div className="muted">Regatta-Analyse für den Vakaros Atlas 2</div>
        <label>E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <label>Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" style={{ width: '100%', marginTop: 16 }} disabled={busy}>
          {busy ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
