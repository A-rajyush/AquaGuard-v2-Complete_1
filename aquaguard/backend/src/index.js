require('dotenv').config();
const express      = require('express');
const http         = require('http');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const { WebSocketServer } = require('ws');

const logger    = require('./utils/logger');
const db        = require('./models/db');
const { router: authRouter, requireAuth } = require('./services/auth');
const { health, sensors, alerts, analytics, ml } = require('./routes/index');
const { initWebSocket } = require('./services/websocket');
const { startSensorSimulator } = require('./services/sensorSimulator');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true, exposedHeaders: ['Authorization'] }));
app.use(morgan('tiny', { stream: { write: m => logger.info(m.trim()) } }));
app.use(express.json({ limit: '5mb' }));

const apiLimit  = rateLimit({ windowMs: 60000, max: 600, message: { error: 'Rate limit exceeded' } });
const authLimit = rateLimit({ windowMs: 60000, max: 20,  message: { error: 'Too many auth attempts' } });
app.use('/api/', apiLimit);
app.use('/api/auth/', authLimit);

app.use('/api/auth',      authRouter);
app.use('/api/health',    health);
app.use('/api/sensors',   requireAuth, sensors);
app.use('/api/alerts',    requireAuth, alerts);
app.use('/api/analytics', requireAuth, analytics);
app.use('/api/ml',        requireAuth, ml);

app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));
app.use((err, req, res, next) => { logger.error(err.message); res.status(err.status||500).json({ error: 'Server error' }); });

const wss = new WebSocketServer({ server });
initWebSocket(wss);

async function start() {
  await db.connect();
  server.listen(PORT, () => {
    logger.info(`🌊 AquaGuard API  →  http://localhost:${PORT}/api/health`);
    logger.info(`📡 WebSocket      →  ws://localhost:${PORT}`);
    logger.info(`🔐 Auth           →  POST /api/auth/login | /api/auth/register`);
    startSensorSimulator();
  });
}

start().catch(err => { logger.error(err); process.exit(1); });
module.exports = { app, server };
