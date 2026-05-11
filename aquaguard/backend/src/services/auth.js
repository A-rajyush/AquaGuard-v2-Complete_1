const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { Router } = require('express');
const db       = require('../models/db');
const { store } = require('../models/store');
const logger   = require('../utils/logger');

const JWT_SECRET  = process.env.JWT_SECRET  || 'aquaguard-dev-secret-change-in-prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ── Token helpers ─────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ── In-memory user store (fallback when no DB) ────────────────────────────────
const memUsers = new Map();   // email → user record

// ── Middleware: protect routes ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

// ── Auth Router ───────────────────────────────────────────────────────────────
const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'viewer' } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const hash = await bcrypt.hash(password, 12);

  try {
    let user;
    if (db.isDB()) {
      const existing = await db.findUserByEmail(email);
      if (existing) return res.status(409).json({ error: 'Email already registered' });
      user = await db.createUser(name, email, hash, role);
    } else {
      // In-memory fallback
      if (memUsers.has(email)) return res.status(409).json({ error: 'Email already registered' });
      user = { id: `u_${Date.now()}`, name, email, role, created_at: new Date().toISOString() };
      memUsers.set(email, { ...user, password: hash });
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    logger.info(`User registered: ${email}`);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    logger.error(`Register error: ${e.message}`);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password required' });

  try {
    let user, hash;
    if (db.isDB()) {
      const row = await db.findUserByEmail(email);
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });
      user = row; hash = row.password;
    } else {
      const row = memUsers.get(email);
      if (!row) return res.status(401).json({ error: 'Invalid credentials' });
      user = row; hash = row.password;
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    logger.info(`Login: ${email}`);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    logger.error(`Login error: ${e.message}`);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    let user;
    if (db.isDB()) {
      user = await db.findUserById(req.user.id);
    } else {
      const row = [...memUsers.values()].find(u => u.id === req.user.id);
      if (row) { const { password, ...rest } = row; user = rest; }
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', requireAuth, (req, res) => {
  const token = signToken({ id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name });
  res.json({ token });
});

module.exports = { router, requireAuth, requireRole };
