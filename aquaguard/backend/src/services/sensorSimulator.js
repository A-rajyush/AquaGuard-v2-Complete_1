const cron  = require('node-cron');
const { v4 } = require('uuid');
const { pushReading, pushAlert, SENSOR_LOCATIONS, store } = require('../models/store');
const { broadcast } = require('./websocket');
const { analyzeReading } = require('./mlEngine');
const logger = require('../utils/logger');

const WHO = {
  ph:           { lo: 6.5,  hi: 8.5,   unit: 'pH'    },
  turbidity:    { lo: 0,    hi: 4.0,   unit: 'NTU'   },
  temperature:  { lo: 5,    hi: 30,    unit: '°C'    },
  dissolvedO2:  { lo: 6.0,  hi: 14.0,  unit: 'mg/L'  },
  conductivity: { lo: 50,   hi: 1500,  unit: 'µS/cm' },
  nitrates:     { lo: 0,    hi: 10.0,  unit: 'mg/L'  },
};

function calcWQI(r) {
  const scores = [
    Math.max(0, 100 - Math.abs(r.ph - 7) * 20),
    Math.max(0, 100 - (r.turbidity  / WHO.turbidity.hi)   * 100),
    Math.min(100,     (r.dissolvedO2 / WHO.dissolvedO2.hi) * 100),
    Math.max(0, 100 - (r.nitrates   / WHO.nitrates.hi)    * 100),
    Math.max(0, 100 - Math.abs(r.temperature - 20) * 3),
  ];
  return +(scores.reduce((a, b) => a + b) / scores.length).toFixed(1);
}

function quality(r) {
  const bad = Object.entries(WHO).filter(([p, b]) => r[p] < b.lo || r[p] > b.hi).length;
  if (bad === 0) return 'safe';
  if (bad === 1) return 'warning';
  return 'critical';
}

const prev = {};

function nextVal(cur, lo, hi, driftPct = 0.03, anomalyChance = 0.04) {
  const base   = cur ?? (lo + hi) / 2 + (Math.random() - 0.5) * (hi - lo) * 0.2;
  const delta  = (Math.random() - 0.5) * (hi - lo) * driftPct;
  let  next    = base + delta;
  if (Math.random() < anomalyChance) next = hi * (1.1 + Math.random() * 0.5);
  return +Math.max(lo * 0.4, Math.min(hi * 1.6, next)).toFixed(3);
}

function genReading(sensorId) {
  const p = prev[sensorId] || {};
  const r = {
    id:           v4(),
    sensorId,
    timestamp:    new Date().toISOString(),
    ph:           nextVal(p.ph,          WHO.ph.lo,           WHO.ph.hi,           0.02, 0.03),
    turbidity:    nextVal(p.turbidity,   WHO.turbidity.lo,    WHO.turbidity.hi,    0.05, 0.06),
    temperature:  nextVal(p.temperature, WHO.temperature.lo,  WHO.temperature.hi,  0.02, 0.02),
    dissolvedO2:  nextVal(p.dissolvedO2, WHO.dissolvedO2.lo,  WHO.dissolvedO2.hi,  0.03, 0.03),
    conductivity: nextVal(p.conductivity,WHO.conductivity.lo, WHO.conductivity.hi, 0.03, 0.02),
    nitrates:     nextVal(p.nitrates,    WHO.nitrates.lo,     WHO.nitrates.hi,     0.04, 0.04),
  };
  r.wqi     = calcWQI(r);
  r.quality = quality(r);
  return r;
}

async function tick() {
  for (const loc of SENSOR_LOCATIONS) {
    const r    = genReading(loc.id);
    r.mlPrediction = analyzeReading(r);
    prev[loc.id]   = r;

    pushReading(r);

    // update sensor meta
    const s = store.sensors.get(loc.id);
    if (s) { s.lastSeen = r.timestamp; s.batteryLevel = Math.max(10, s.batteryLevel - 0.005); }

    // alert on critical or high ML risk
    if (r.quality === 'critical' || r.mlPrediction.contamination_risk > 0.75) {
      pushAlert({
        sensorId:   loc.id,
        sensorName: loc.name,
        city:       loc.city,
        type:       r.mlPrediction.contamination_risk > 0.75 ? 'ML_RISK' : 'THRESHOLD',
        severity:   r.quality === 'critical' ? 'critical' : 'high',
        message:    r.mlPrediction.contamination_risk > 0.75
          ? `AI contamination risk ${(r.mlPrediction.contamination_risk * 100).toFixed(1)}% at ${loc.name}`
          : `Threshold breach at ${loc.name} — WQI ${r.wqi}`,
        wqi: r.wqi,
      });
    }

    broadcast({ type: 'SENSOR_UPDATE', payload: { ...r, sensor: loc } });
  }
}

function startSensorSimulator() {
  logger.info('🔬 Sensor simulator started (5 s cadence)');
  tick();
  cron.schedule('*/5 * * * * *', tick);
}

module.exports = { startSensorSimulator };
