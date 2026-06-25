// api.js — thin wrapper around fetch that attaches the login token
// and handles errors consistently across the app.

// In production (deployed on Render), the frontend is a separate static
// site from the backend, so it needs the backend's full URL. Locally,
// the Vite dev server proxy (see vite.config.js) handles plain "/api".
const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('vault_token');
}

export function setToken(token) {
  localStorage.setItem('vault_token', token);
}

export function clearToken() {
  localStorage.removeItem('vault_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Session expired.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

export const api = {
  login: (password) => request('/login', { method: 'POST', body: JSON.stringify({ password }) }),

  getAccounts: () => request('/accounts'),
  upsertAccount: (payload) => request('/accounts/upsert', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  getAccountHistory: (id) => request(`/accounts/${id}/history`),

  getScreens: () => request('/screens'),
  createScreen: (name, type) => request('/screens', { method: 'POST', body: JSON.stringify({ name, type }) }),
  deleteScreen: (id) => request(`/screens/${id}`, { method: 'DELETE' }),

  getTable: (screenId) => request(`/screens/${screenId}/table`),
  addColumn: (screenId, name) => request(`/screens/${screenId}/columns`, { method: 'POST', body: JSON.stringify({ name }) }),
  renameColumn: (columnId, name) => request(`/screens/columns/${columnId}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  deleteColumn: (columnId) => request(`/screens/columns/${columnId}`, { method: 'DELETE' }),
  addRow: (screenId, row_data) => request(`/screens/${screenId}/rows`, { method: 'POST', body: JSON.stringify({ row_data }) }),
  updateRow: (rowId, row_data) => request(`/screens/rows/${rowId}`, { method: 'PATCH', body: JSON.stringify({ row_data }) }),
  deleteRow: (rowId) => request(`/screens/rows/${rowId}`, { method: 'DELETE' }),

  getNotes: (screenId) => request(`/screens/${screenId}/notes`),
  addNote: (screenId, title, body) => request(`/screens/${screenId}/notes`, { method: 'POST', body: JSON.stringify({ title, body }) }),
  updateNote: (noteId, title, body) => request(`/screens/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ title, body }) }),
  deleteNote: (noteId) => request(`/screens/notes/${noteId}`, { method: 'DELETE' }),

  sendChat: (message) => request('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  getChatHistory: () => request('/chat/history'),
};

export { getToken };
