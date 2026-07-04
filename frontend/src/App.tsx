import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Logo } from './components/Logo';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { Import } from './views/Import';
import { SessionView } from './views/SessionView';
import { BoatManager } from './views/BoatManager';
import { PolarEditor } from './views/PolarEditor';

export function App() {
  const { loading, authenticated, email, logout } = useAuth();

  if (loading) {
    return <div className="login-wrap spinner">Lädt…</div>;
  }
  if (!authenticated) {
    return <Login />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          Atlas&nbsp;<span>Analytics</span>
        </div>
        <nav>
          <NavLink to="/" end>
            Sessions
          </NavLink>
          <NavLink to="/import">Import</NavLink>
          <NavLink to="/boats">Boote</NavLink>
        </nav>
        <div className="spacer" />
        <span className="muted">{email}</span>
        <button onClick={() => logout()}>Abmelden</button>
      </header>
      <main className="content">
        <div className="container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/import" element={<Import />} />
            <Route path="/sessions/:id" element={<SessionView />} />
            <Route path="/boats" element={<BoatManager />} />
            <Route path="/boats/:boatId/polar/:polarId" element={<PolarEditor />} />
            <Route path="/boats/:boatId/polar/new" element={<PolarEditor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
