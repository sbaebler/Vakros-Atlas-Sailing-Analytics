import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from './api/client';

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setAuthenticated(me.authenticated);
        setEmail(me.user?.email ?? null);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  const login = async (e: string, p: string) => {
    await api.login(e, p);
    const me = await api.me();
    setAuthenticated(me.authenticated);
    setEmail(me.user?.email ?? null);
  };

  const logout = async () => {
    await api.logout();
    setAuthenticated(false);
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ loading, authenticated, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
