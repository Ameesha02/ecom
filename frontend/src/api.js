const BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const tokens = {
  get access() { return localStorage.getItem('accessToken'); },
  get refresh() { return localStorage.getItem('refreshToken'); },
  set({ accessToken, refreshToken }) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clear() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};

let refreshing = null; // share one refresh call between concurrent 401s

async function refreshTokens() {
  if (!tokens.refresh) return false;
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: tokens.refresh }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      tokens.set(await r.json());
      return true;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(tokens.access && { Authorization: `Bearer ${tokens.access}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && tokens.refresh && (await refreshTokens())) {
    return api(path, { method, body, retry: false });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  // 402 (payment declined) still carries a useful payment body
  if (!res.ok) {
    const d = data.error?.details?.map((x) => `${x.path}: ${x.message}`).join('; ');
    throw new ApiError(res.status, [data.error?.message || res.statusText, d].filter(Boolean).join(' - '), data);
  }
  return data;
}
