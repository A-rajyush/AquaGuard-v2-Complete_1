/**
 * AquaGuard Database Layer
 * Uses PostgreSQL when DATABASE_URL is set, falls back to in-memory store.
 * Swap pg → @aws-sdk/client-dynamodb for DynamoDB in prod.
 */
const { Pool } = require('pg');
const logger   = require('../utils/logger');

let pool = null;
let usingDB = false;

async function connect() {
  if (!process.env.DATABASE_URL) {
    logger.info('📦 No DATABASE_URL — using in-memory store (set DATABASE_URL for PostgreSQL)');
    return;
  }
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, idleTimeoutMillis: 30000 });
    await pool.query('SELECT 1');
    usingDB = true;
    logger.info('🐘 PostgreSQL connected');
    await runMigrations();
  } catch (err) {
    logger.warn(`PostgreSQL unavailable (${err.message}) — falling back to in-memory store`);
    pool = null;
    usingDB = false;
  }
}

async function runMigrations() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'viewer',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sensor_id    TEXT NOT NULL,
      timestamp    TIMESTAMPTZ DEFAULT NOW(),
      ph           NUMERIC(6,3),
      turbidity    NUMERIC(6,3),
      temperature  NUMERIC(6,3),
      dissolved_o2 NUMERIC(6,3),
      conductivity NUMERIC(7,3),
      nitrates     NUMERIC(6,3),
      wqi          NUMERIC(5,1),
      quality      TEXT,
      ml_prediction JSONB
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sensor_id   TEXT NOT NULL,
      sensor_name TEXT,
      city        TEXT,
      type        TEXT,
      severity    TEXT,
      message     TEXT,
      wqi         NUMERIC(5,1),
      resolved    BOOLEAN DEFAULT FALSE,
      resolved_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_readings_sensor    ON sensor_readings(sensor_id);
    CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_resolved    ON alerts(resolved);
  `);
  logger.info('✅ DB migrations complete');
}

// ── Query helpers ─────────────────────────────────────────────────────────────

async function saveReading(r) {
  if (!usingDB || !pool) return;   // in-memory path handled by store.js
  try {
    await pool.query(
      `INSERT INTO sensor_readings
       (id, sensor_id, timestamp, ph, turbidity, temperature, dissolved_o2, conductivity, nitrates, wqi, quality, ml_prediction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [r.id, r.sensorId, r.timestamp, r.ph, r.turbidity, r.temperature,
       r.dissolvedO2, r.conductivity, r.nitrates, r.wqi, r.quality,
       JSON.stringify(r.mlPrediction || {})]
    );
  } catch (e) { logger.error(`saveReading: ${e.message}`); }
}

async function saveAlert(a) {
  if (!usingDB || !pool) return;
  try {
    await pool.query(
      `INSERT INTO alerts (id, sensor_id, sensor_name, city, type, severity, message, wqi, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [a.id, a.sensorId, a.sensorName, a.city, a.type, a.severity, a.message, a.wqi, a.createdAt]
    );
  } catch (e) { logger.error(`saveAlert: ${e.message}`); }
}

async function resolveAlertDB(id) {
  if (!usingDB || !pool) return;
  await pool.query(`UPDATE alerts SET resolved=TRUE, resolved_at=NOW() WHERE id=$1`, [id]);
}

async function getReadingsDB(sensorId, limit = 50) {
  if (!usingDB || !pool) return null;
  const r = await pool.query(
    `SELECT * FROM sensor_readings WHERE sensor_id=$1 ORDER BY timestamp DESC LIMIT $2`,
    [sensorId, limit]
  );
  return r.rows.map(row => ({
    id: row.id, sensorId: row.sensor_id, timestamp: row.timestamp,
    ph: +row.ph, turbidity: +row.turbidity, temperature: +row.temperature,
    dissolvedO2: +row.dissolved_o2, conductivity: +row.conductivity,
    nitrates: +row.nitrates, wqi: +row.wqi, quality: row.quality,
    mlPrediction: row.ml_prediction,
  }));
}

async function getAlertsDB(filters = {}) {
  if (!usingDB || !pool) return null;
  let q = 'SELECT * FROM alerts WHERE 1=1';
  const params = [];
  if (filters.resolved !== undefined) { q += ` AND resolved=$${params.length+1}`; params.push(filters.resolved); }
  if (filters.severity)               { q += ` AND severity=$${params.length+1}`;  params.push(filters.severity); }
  q += ` ORDER BY created_at DESC LIMIT $${params.length+1}`;
  params.push(filters.limit || 100);
  const r = await pool.query(q, params);
  return r.rows;
}

// User helpers
async function createUser(name, email, hashedPassword, role = 'viewer') {
  if (!pool) return null;
  const r = await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, created_at`,
    [name, email, hashedPassword, role]
  );
  return r.rows[0];
}

async function findUserByEmail(email) {
  if (!pool) return null;
  const r = await pool.query(`SELECT * FROM users WHERE email=$1`, [email]);
  return r.rows[0] || null;
}

async function findUserById(id) {
  if (!pool) return null;
  const r = await pool.query(`SELECT id, name, email, role, created_at FROM users WHERE id=$1`, [id]);
  return r.rows[0] || null;
}

module.exports = {
  connect, pool: () => pool, isDB: () => usingDB,
  saveReading, saveAlert, resolveAlertDB,
  getReadingsDB, getAlertsDB,
  createUser, findUserByEmail, findUserById,
};
