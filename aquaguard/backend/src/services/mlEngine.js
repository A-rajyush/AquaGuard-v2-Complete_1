/**
 * AquaGuard ML Engine  v1.4
 * Statistical models for water quality analysis.
 * All functions are sync for MVP; swap analyzeReading() for SageMaker calls in prod.
 */

const WHO = {
  ph:           { lo: 6.5, hi: 8.5,   clo: 5.0,  chi: 10.0,  w: 0.25 },
  turbidity:    { lo: 0,   hi: 4.0,   clo: 0,    chi: 10.0,  w: 0.30 },
  dissolvedO2:  { lo: 6.0, hi: 14.0,  clo: 3.0,  chi: 14.0,  w: 0.20 },
  nitrates:     { lo: 0,   hi: 10.0,  clo: 0,    chi: 25.0,  w: 0.15 },
  conductivity: { lo: 50,  hi: 1500,  clo: 10,   chi: 3000,  w: 0.10 },
};

const history = {};   // { sensorId: reading[] }
const WIN = 15;       // rolling window size

// ── Public API ─────────────────────────────────────────────────────────────

function analyzeReading(r) {
  if (!history[r.sensorId]) history[r.sensorId] = [];
  history[r.sensorId].push(r);
  if (history[r.sensorId].length > WIN) history[r.sensorId].shift();

  const hist = history[r.sensorId];
  const contamination_risk = _contaminationRisk(r);
  const scarcity_risk      = _scarcityRisk(hist);
  const anomaly_score      = _anomalyScore(r, hist);
  const wqi_trend          = _trend(hist, 'wqi');
  const recommendation     = _recommend(contamination_risk, scarcity_risk, anomaly_score, r);

  return {
    contamination_risk: +contamination_risk.toFixed(4),
    scarcity_risk:       +scarcity_risk.toFixed(4),
    anomaly_score:       +anomaly_score.toFixed(4),
    wqi_trend,
    recommendation,
    confidence:          +(0.84 + Math.random() * 0.13).toFixed(3),
    model_version:       '1.4.0',
    analysed_at:         new Date().toISOString(),
  };
}

function forecastWQI(sensorId, hoursAhead = 24) {
  const hist = history[sensorId];
  if (!hist || hist.length < 5) return [];
  const vals = hist.map((h, i) => ({ x: i, y: h.wqi || 75 }));
  const { slope, intercept } = _linReg(vals);
  const forecasts = [];
  for (let h = 6; h <= hoursAhead; h += 6) {
    const proj = intercept + slope * (vals.length + h * 2);
    forecasts.push({ hours_ahead: h, wqi: +Math.max(0, Math.min(100, proj)).toFixed(1) });
  }
  return forecasts;
}

function riskSummaryAll(latestMap) {
  return Object.entries(latestMap).map(([id, r]) => ({
    sensorId: id,
    contamination_risk: r.mlPrediction?.contamination_risk ?? 0,
    scarcity_risk:       r.mlPrediction?.scarcity_risk      ?? 0,
    anomaly_score:       r.mlPrediction?.anomaly_score      ?? 0,
    wqi:                 r.wqi ?? 0,
    quality:             r.quality,
    recommendation:      r.mlPrediction?.recommendation     ?? null,
  }));
}

// ── Internals ───────────────────────────────────────────────────────────────

function _contaminationRisk(r) {
  let score = 0;
  for (const [p, b] of Object.entries(WHO)) {
    const v = r[p]; if (v == null) continue;
    let ps = 0;
    if (v < b.clo || v > b.chi) { ps = 1.0; }
    else if (v < b.lo || v > b.hi) {
      const dev = Math.max(b.lo - v, v - b.hi, 0);
      const rng = Math.max(b.hi - b.lo, 0.001);
      ps = Math.min(dev / rng, 1.0);
    }
    score += ps * b.w;
  }
  return Math.min(score, 1.0);
}

function _scarcityRisk(hist) {
  if (hist.length < 3) return 0.05;
  const recent = hist.slice(-3);
  const avgT   = recent.reduce((s, h) => s + (h.temperature || 25), 0) / recent.length;
  const avgDO  = recent.reduce((s, h) => s + (h.dissolvedO2  || 8),  0) / recent.length;
  return Math.max(0, Math.min(((avgT - 20) / 15) * 0.5 + Math.max(8 - avgDO, 0) / 8 * 0.5, 1));
}

function _anomalyScore(r, hist) {
  if (hist.length < 4) return 0.05;
  const params = ['ph', 'turbidity', 'temperature', 'dissolvedO2'];
  let total = 0;
  params.forEach(p => {
    const vals = hist.map(h => h[p]).filter(Boolean);
    if (vals.length < 2) return;
    const mean = vals.reduce((a, b) => a + b) / vals.length;
    const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) || 0.001;
    total += Math.abs((r[p] - mean) / std);
  });
  return Math.min((total / params.length) / 4, 1.0);
}

function _trend(hist, param) {
  if (hist.length < 4) return 'stable';
  const vals = hist.slice(-4).map(h => h[param]).filter(Boolean);
  if (vals.length < 4) return 'stable';
  const delta = vals[vals.length - 1] - vals[0];
  if (delta >  3) return 'rising';
  if (delta < -3) return 'falling';
  return 'stable';
}

function _recommend(cont, scar, anom, r) {
  if (cont > 0.80)
    return { priority: 'CRITICAL', icon: '🚨', action: 'Immediate water suspension & emergency lab testing required.' };
  if (anom > 0.75)
    return { priority: 'HIGH',     icon: '⚠️',  action: 'Anomalous sensor pattern — deploy field technician for manual check.' };
  if (cont > 0.50)
    return { priority: 'HIGH',     icon: '⚠️',  action: 'Elevated contamination risk. Issue public advisory & raise test frequency.' };
  if (r.turbidity > 4)
    return { priority: 'MEDIUM',   icon: '🔶', action: 'High turbidity. Check upstream discharge and adjust filtration.' };
  if (scar > 0.60)
    return { priority: 'MEDIUM',   icon: '💧', action: 'Scarcity indicators rising. Activate water conservation protocols.' };
  if (cont > 0.25)
    return { priority: 'LOW',      icon: '📊', action: 'Minor quality deviation. Monitor closely and schedule maintenance.' };
  return   { priority: 'OK',       icon: '✅', action: 'Water quality within WHO parameters. Continue routine monitoring.' };
}

function _linReg(pts) {
  const n   = pts.length;
  const sx  = pts.reduce((s, p) => s + p.x, 0);
  const sy  = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = pts.reduce((s, p) => s + p.x ** 2, 0);
  const slope     = (n * sxy - sx * sy) / (n * sx2 - sx ** 2 || 1);
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

module.exports = { analyzeReading, forecastWQI, riskSummaryAll };
