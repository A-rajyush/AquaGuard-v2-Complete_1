const { Router } = require('express');
const { store, SENSOR_LOCATIONS, latestBySensor } = require('../models/store');
const { forecastWQI, analyzeReading, riskSummaryAll } = require('../services/mlEngine');
const { clients } = require('../services/websocket');

// ── /api/health ──────────────────────────────────────────────────────────────
const health = Router();
health.get('/', (req, res) => res.json({
  status: 'healthy', service: 'AquaGuard API', version: '1.0.0',
  uptime: process.uptime(), sensors: store.sensors.size,
  readings: store.readings.length, alerts: store.alerts.length,
  wsClients: clients.size, timestamp: new Date().toISOString(),
}));

// ── /api/sensors ─────────────────────────────────────────────────────────────
const sensors = Router();
sensors.get('/', (req, res) => {
  const latest = latestBySensor();
  const list = SENSOR_LOCATIONS.map(loc => ({
    ...loc, ...store.sensors.get(loc.id), latestReading: latest[loc.id] || null
  }));
  res.json({ sensors: list, count: list.length, ts: new Date().toISOString() });
});
sensors.get('/:id', (req, res) => {
  const s = store.sensors.get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sensor not found' });
  const readings = store.readings.filter(r => r.sensorId === req.params.id).slice(-60);
  res.json({ sensor: s, readings, count: readings.length });
});
sensors.get('/:id/readings', (req, res) => {
  const { limit = 50 } = req.query;
  const readings = store.readings.filter(r => r.sensorId === req.params.id).slice(-+limit);
  res.json({ readings, limit: +limit });
});
sensors.get('/:id/stats', (req, res) => {
  const readings = store.readings.filter(r => r.sensorId === req.params.id);
  if (!readings.length) return res.json({ message: 'No data yet' });
  const params = ['ph','turbidity','temperature','dissolvedO2','conductivity','nitrates','wqi'];
  const stats = {};
  params.forEach(p => {
    const vals = readings.map(r => r[p]).filter(v => v != null);
    if (!vals.length) return;
    stats[p] = { min: +Math.min(...vals).toFixed(3), max: +Math.max(...vals).toFixed(3),
                 avg: +(vals.reduce((a,b)=>a+b)/vals.length).toFixed(3), last: +vals.at(-1).toFixed(3) };
  });
  res.json({ sensorId: req.params.id, stats, count: readings.length });
});

// ── /api/alerts ──────────────────────────────────────────────────────────────
const alerts = Router();
alerts.get('/', (req, res) => {
  let list = [...store.alerts];
  if (req.query.severity) list = list.filter(a => a.severity === req.query.severity);
  if (req.query.resolved !== undefined) list = list.filter(a => a.resolved === (req.query.resolved === 'true'));
  res.json({ alerts: list.slice(0, +(req.query.limit || 100)), count: list.length });
});
alerts.patch('/:id/resolve', (req, res) => {
  const a = store.alerts.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  a.resolved = true; a.resolvedAt = new Date().toISOString();
  res.json({ alert: a });
});

// ── /api/analytics ───────────────────────────────────────────────────────────
const analytics = Router();
analytics.get('/overview', (req, res) => {
  const { readings, alerts: al, sensors: sm } = store;
  const online   = [...sm.values()].filter(s => s.status === 'online').length;
  const recent   = readings.slice(-100);
  const avgWQI   = recent.length ? +(recent.reduce((s,r)=>s+(r.wqi||0),0)/recent.length).toFixed(1) : 0;
  const crit     = readings.filter(r=>r.quality==='critical').length;
  res.json({
    totalReadings: readings.length, onlineSensors: online, totalSensors: sm.size,
    avgWQI, criticalCount: crit, safeCount: readings.filter(r=>r.quality==='safe').length,
    activeAlerts: al.filter(a=>!a.resolved).length,
    criticalRate: readings.length ? +(crit/readings.length*100).toFixed(1) : 0,
    ts: new Date().toISOString(),
  });
});
analytics.get('/wqi-history', (req, res) => {
  const mins  = +(req.query.minutes || 30);
  const since = new Date(Date.now() - mins * 60000).toISOString();
  const recent = store.readings.filter(r => r.timestamp > since);
  const bySensor = {};
  recent.forEach(r => {
    if (!bySensor[r.sensorId]) bySensor[r.sensorId] = [];
    bySensor[r.sensorId].push({ t: r.timestamp, wqi: r.wqi, quality: r.quality });
  });
  res.json({ bySensor, since, count: recent.length });
});
analytics.get('/quality-distribution', (req, res) => {
  const recent = store.readings.slice(-300);
  const dist   = { safe: 0, warning: 0, critical: 0 };
  recent.forEach(r => { if (dist[r.quality] !== undefined) dist[r.quality]++; });
  res.json({ distribution: dist, total: recent.length });
});
analytics.get('/param-trends', (req, res) => {
  const recent = store.readings.slice(-200);
  const params = ['ph','turbidity','temperature','dissolvedO2','wqi'];
  const trend  = {};
  params.forEach(p => {
    const vals = recent.map((r,i)=>({ x: i, y: r[p]||0 }));
    trend[p] = vals.slice(-40).map(v => v.y);
  });
  res.json({ trend });
});

// ── /api/ml ───────────────────────────────────────────────────────────────────
const ml = Router();
ml.get('/forecast/:id', (req, res) => {
  const forecast = forecastWQI(req.params.id, 24);
  res.json({ sensorId: req.params.id, forecast, generatedAt: new Date().toISOString() });
});
ml.post('/analyze', (req, res) => {
  if (!req.body?.sensorId) return res.status(400).json({ error: 'sensorId required' });
  res.json({ result: analyzeReading(req.body), input: req.body });
});
ml.get('/risk-summary', (req, res) => {
  res.json({ summary: riskSummaryAll(latestBySensor()), ts: new Date().toISOString() });
});

module.exports = { health, sensors, alerts, analytics, ml };
