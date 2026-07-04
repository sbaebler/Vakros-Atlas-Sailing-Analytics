// Thin fetch wrapper for the PHP API. Carries the session cookie automatically and
// attaches the CSRF token (fetched from /api/me) to every mutating request.

export interface Boat {
  id: number;
  name: string;
  boat_class: string;
  sail_number: string;
  notes: string | null;
  created_at?: string;
}

export interface PolarRecord {
  id: number;
  boat_id: number;
  name: string;
  source: string;
  data: import('../analysis/polar').Polar;
  created_at?: string;
}

export interface SessionSummary {
  id: number;
  name: string;
  sailed_at: string | null;
  source_format: string;
  duration_s: number;
  stats: import('../analysis/analyze').SessionStats | null;
  boat_id: number | null;
  boat_name?: string | null;
  boat_class?: string | null;
  created_at?: string;
}

let csrfToken = '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch(`/api/${path}`, {
    method,
    credentials: 'same-origin',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as any)?.error ?? res.statusText, res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export interface MeResponse {
  authenticated: boolean;
  user?: { id: number; email: string };
  csrf: string;
}

export const api = {
  async me(): Promise<MeResponse> {
    const me = await request<MeResponse>('GET', 'me');
    csrfToken = me.csrf;
    return me;
  },
  async login(email: string, password: string): Promise<void> {
    const r = await request<{ csrf: string }>('POST', 'auth/login', { email, password });
    csrfToken = r.csrf;
  },
  logout: () => request<void>('POST', 'auth/logout'),

  listBoats: () => request<Boat[]>('GET', 'boats'),
  createBoat: (b: Partial<Boat>) => request<{ id: number }>('POST', 'boats', b),
  updateBoat: (id: number, b: Partial<Boat>) => request<void>('PUT', `boats/${id}`, b),
  deleteBoat: (id: number) => request<void>('DELETE', `boats/${id}`),

  listPolars: (boatId: number) => request<PolarRecord[]>('GET', `boats/${boatId}/polars`),
  createPolar: (boatId: number, p: { name: string; source?: string; data: unknown }) =>
    request<{ id: number }>('POST', `boats/${boatId}/polars`, p),
  updatePolar: (id: number, p: { name: string; source?: string; data: unknown }) =>
    request<void>('PUT', `polars/${id}`, p),
  deletePolar: (id: number) => request<void>('DELETE', `polars/${id}`),

  listSessions: () => request<SessionSummary[]>('GET', 'sessions'),
  getSession: (id: number) => request<any>('GET', `sessions/${id}`),
  getSessionTrack: (id: number) =>
    request<import('../parse/types').Sample[]>('GET', `sessions/${id}/track`),
  createSession: (s: unknown) => request<{ id: number }>('POST', 'sessions', s),
  updateSession: (id: number, s: unknown) => request<void>('PUT', `sessions/${id}`, s),
  deleteSession: (id: number) => request<void>('DELETE', `sessions/${id}`),
};
