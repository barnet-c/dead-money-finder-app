/**
 * API client — drop-in replacement for the Base44 SDK surface used by the app:
 *   api.entities.<Name>.list / filter / get / create / bulkCreate / update / delete
 *   api.functions.invoke(name, payload)
 *   api.auth.me / login / register / logout
 *   api.connectors.connectAppUser()  (Gmail OAuth popup)
 */

export class ApiError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || `Request failed (${res.status})`, {
      status: res.status,
      code: data?.error,
      data,
    });
  }
  return data;
}

const ENTITY_NAMES = ['CustomerServiceRecord', 'BusinessSettings', 'ReminderLog', 'Invoice', 'UnconfirmedInvoice'];

function entity(name) {
  const base = `/api/entities/${name}`;
  return {
    list: (sort, limit) => {
      const q = new URLSearchParams();
      if (sort) q.set('sort', sort);
      if (limit) q.set('limit', String(limit));
      const qs = q.toString();
      return request('GET', qs ? `${base}?${qs}` : base);
    },
    filter: (where, sort, limit) => request('POST', `${base}/filter`, { where, sort, limit }),
    get: (id) => request('GET', `${base}/${id}`),
    create: (data) => request('POST', base, data),
    bulkCreate: (items) => request('POST', `${base}/bulk`, items),
    update: (id, data) => request('PATCH', `${base}/${id}`, data),
    delete: (id) => request('DELETE', `${base}/${id}`),
  };
}

export const api = {
  entities: Object.fromEntries(ENTITY_NAMES.map((n) => [n, entity(n)])),
  functions: {
    invoke: (name, payload = {}) => request('POST', `/api/functions/${name}`, payload),
  },
  auth: {
    me: () => request('GET', '/api/auth/me'),
    login: (creds) => request('POST', '/api/auth/login', creds),
    register: (creds) => request('POST', '/api/auth/register', creds),
    logout: () => request('POST', '/api/auth/logout', {}),
    updateMe: (patch) => request('PATCH', '/api/auth/me', patch),
  },
  health: () => request('GET', '/api/health'),
  connectors: {
    /** Opens the Gmail OAuth popup; resolves when the popup closes. */
    connectAppUser() {
      return new Promise((resolve) => {
        const w = 520;
        const h = 640;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        const popup = window.open('/api/gmail/connect', 'gmail_connect', `width=${w},height=${h},left=${left},top=${top}`);
        if (!popup) return resolve({ opened: false });
        const onMsg = (e) => {
          if (e.data?.type === 'gmail_connected') {
            window.removeEventListener('message', onMsg);
            try { popup.close(); } catch { /* ignore */ }
          }
        };
        window.addEventListener('message', onMsg);
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            window.removeEventListener('message', onMsg);
            resolve({ opened: true });
          }
        }, 500);
      });
    },
    disconnectGmail: () => request('POST', '/api/gmail/disconnect', {}),
  },
};

export default api;
