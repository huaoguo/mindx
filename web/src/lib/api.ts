// API types and client for MindX

export interface User {
  id: number;
  key: string;
  name: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Doc {
  id: number;
  filename: string;
  type: 'user' | 'soul' | 'memory' | 'log' | 'chat';
  content: string;
  agent_name: string;
  file_created_at: string;
  uploaded_at: string;
}

export interface Insight {
  id: number;
  content: string;
  value_summary: string;
  category: 'preference' | 'fact' | 'constraint' | 'decision' | 'goal' | 'insight' | 'relationship' | 'event';
  confidence: number;
  status: 'confirmed' | 'pending' | 'deprecated';
  source_type: 'document' | 'note';
  source_id: number;
  source_name: string | null;
  source_quote: string | null;
  source_position: string | null;
  source_timestamp: string | null;
  superseded_by: number | null;
  change_reason: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: number;
  name: string;
  key: string;
  status: 'idle' | 'installing' | 'connected';
  created_at: string;
}

export interface ExtractionResult {
  source: { type: string; id: number; title: string };
  stats: { added: number; updated: number; deprecated: number; skipped: number };
  created: Insight[];
}

// --- Auth ---

let _apiKey: string | null = localStorage.getItem('apiKey');

export function getApiKey() { return _apiKey; }
export function setApiKey(key: string | null) {
  _apiKey = key;
  if (key) localStorage.setItem('apiKey', key);
  else localStorage.removeItem('apiKey');
}

// --- Fetch wrapper ---

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_apiKey) headers['Authorization'] = `Bearer ${_apiKey}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && _apiKey && path !== '/api/login' && path !== '/api/register') {
    // Token invalid — auto logout (but not for login/register requests)
    setApiKey(null);
    localStorage.removeItem('userName');
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- API methods ---

export const api = {
  login: (name: string, password: string) => request<User>('POST', '/api/login', { name, password }),
  register: (name: string, password: string) => request<User>('POST', '/api/register', { name, password }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ success: boolean }>('PUT', '/api/user/password', { oldPassword, newPassword }),

  // Notes
  listNotes: () => request<Note[]>('GET', '/api/notes'),
  getNote: (id: number) => request<Note>('GET', `/api/notes/${id}`),
  createNote: (data: { title: string; content: string }) => request<Note>('POST', '/api/notes', data),
  updateNote: (id: number, data: { title?: string; content?: string }) => request<Note>('PUT', `/api/notes/${id}`, data),
  deleteNote: (id: number) => request<{ deleted: boolean }>('DELETE', `/api/notes/${id}`),

  // Docs
  listDocs: (type?: string) => request<Doc[]>('GET', '/api/documents' + (type ? `?type=${type}` : '')),
  getDoc: (id: number) => request<Doc>('GET', `/api/documents/${id}`),

  // Insights
  listInsights: (filters?: { status?: string; category?: string; pinned?: boolean; source_type?: string; source_id?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.pinned) params.set('pinned', 'true');
    if (filters?.source_type) params.set('source_type', filters.source_type);
    if (filters?.source_id) params.set('source_id', String(filters.source_id));
    const qs = params.toString();
    return request<Insight[]>('GET', '/api/insights' + (qs ? `?${qs}` : ''));
  },
  extractInsights: (sourceType: string, sourceId: number) =>
    request<ExtractionResult>('POST', '/api/insights/extract', { source_type: sourceType, source_id: sourceId }),
  updateInsight: (id: number, data: { pinned?: boolean; status?: string }) =>
    request<Insight>('PUT', `/api/insights/${id}`, data),
  deleteInsight: (id: number) => request<{ deleted: boolean }>('DELETE', `/api/insights/${id}`),

  // Agents
  listAgents: () => request<Agent[]>('GET', '/api/agents'),
  createAgent: (name: string) => request<Agent>('POST', '/api/agents', { name }),
  deleteAgent: (id: number) => request<{ deleted: boolean }>('DELETE', `/api/agents/${id}`),
};
