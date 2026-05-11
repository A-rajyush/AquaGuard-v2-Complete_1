import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';
const http = axios.create({ baseURL: BASE, timeout: 10000 });

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('aq_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

http.interceptors.response.use(
  r => r.data,
  e => {
    if (e.response?.status === 401) {
      localStorage.removeItem('aq_token');
      localStorage.removeItem('aq_user');
      window.dispatchEvent(new Event('aq:logout'));
    }
    return Promise.reject(e.response?.data || e);
  }
);

export const authApi = {
  register: (name, email, password) => http.post('/auth/register', { name, email, password }),
  login:    (email, password)        => http.post('/auth/login',    { email, password }),
  me:       ()                       => http.get('/auth/me'),
};
export const sensorApi = {
  list:    ()      => http.get('/sensors'),
  get:     id      => http.get(`/sensors/${id}`),
  readings:(id, n) => http.get(`/sensors/${id}/readings?limit=${n||50}`),
  stats:   id      => http.get(`/sensors/${id}/stats`),
};
export const alertApi = {
  list:    p  => http.get('/alerts', { params: p }),
  resolve: id => http.patch(`/alerts/${id}/resolve`),
};
export const analyticsApi = {
  overview:     ()    => http.get('/analytics/overview'),
  wqiHistory:   mins  => http.get(`/analytics/wqi-history?minutes=${mins||30}`),
  distribution: ()    => http.get('/analytics/quality-distribution'),
  paramTrends:  ()    => http.get('/analytics/param-trends'),
};
export const mlApi = {
  forecast:    id      => http.get(`/ml/forecast/${id}`),
  analyze:     reading => http.post('/ml/analyze', reading),
  riskSummary: ()      => http.get('/ml/risk-summary'),
};
export function openWebSocket(onMsg) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host  = import.meta.env.VITE_WS_HOST || `${proto}://${location.host}`;
  const token = localStorage.getItem('aq_token');
  const ws    = new WebSocket(`${host}/ws-live${token ? `?token=${token}` : ''}`);
  ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch {} };
  return ws;
}
