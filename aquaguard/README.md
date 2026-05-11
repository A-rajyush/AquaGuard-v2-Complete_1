# 💧 AquaGuard — Water Intelligence Platform

> Real-time water quality monitoring · AI/ML contamination detection · JWT Auth · PostgreSQL · Docker · AWS ECS CI/CD

---

## ✅ What's included

| Feature | Status |
|---------|--------|
| React frontend (5 pages) | ✅ |
| Node.js + Express REST API (15 endpoints) | ✅ |
| WebSocket live sensor stream | ✅ |
| ML Engine (contamination, anomaly, scarcity, WQI) | ✅ |
| JWT Authentication (register / login / me / refresh) | ✅ |
| PostgreSQL with auto-migration (in-memory fallback) | ✅ |
| Docker + Docker Compose (with PostgreSQL service) | ✅ |
| GitHub Actions → AWS ECR → ECS CI/CD | ✅ |
| Nginx reverse proxy | ✅ |
| GitHub init script | ✅ |

---

## 🚀 Quick Start

### Option A — Local (2 terminals)

```bash
# Terminal 1 — Backend
cd backend
cp .env.example .env        # edit JWT_SECRET + optionally DATABASE_URL
npm install
npm run dev
# → API:       http://localhost:5000/api/health
# → WebSocket: ws://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# → Dashboard: http://localhost:5173
```

Register any email + password → you're in. No database required.

### Option B — Docker Compose (PostgreSQL included)

```bash
docker-compose up -d --build
# → http://localhost
```

Everything starts in order: PostgreSQL → Backend (waits for healthy DB) → Frontend.

### Option C — Push to GitHub + deploy

```bash
chmod +x scripts/github-init.sh
./scripts/github-init.sh YOUR_GITHUB_USERNAME
```

Then set 3 GitHub Secrets (see CI/CD section below) and push to `main`.

---

## 🔐 Authentication

| Endpoint | Method | Body | Auth |
|----------|--------|------|------|
| `/api/auth/register` | POST | `{ name, email, password }` | ❌ |
| `/api/auth/login` | POST | `{ email, password }` | ❌ |
| `/api/auth/me` | GET | — | ✅ Bearer |
| `/api/auth/refresh` | POST | — | ✅ Bearer |

All other `/api/*` routes require `Authorization: Bearer <token>`.

**In-memory fallback**: If `DATABASE_URL` is not set, users are stored in-memory (lost on restart). Set `DATABASE_URL` for persistence.

---

## 📡 API Reference

### Sensors
```
GET  /api/sensors                        → all sensors + latest reading
GET  /api/sensors/:id                    → sensor detail + 60 readings
GET  /api/sensors/:id/readings?limit=N   → paginated readings
GET  /api/sensors/:id/stats             → min/max/avg statistics
```

### Alerts
```
GET   /api/alerts?resolved=false&severity=critical&limit=100
PATCH /api/alerts/:id/resolve
```

### Analytics
```
GET /api/analytics/overview              → platform KPIs
GET /api/analytics/wqi-history?minutes=30
GET /api/analytics/quality-distribution
GET /api/analytics/param-trends
```

### ML Engine
```
GET  /api/ml/forecast/:sensorId         → 24h WQI forecast
POST /api/ml/analyze                    → analyze custom reading
GET  /api/ml/risk-summary               → risk scores for all sensors
```

### WebSocket events (ws://localhost:5000)
```json
{ "type": "SENSOR_UPDATE", "payload": { "sensorId": "S001", "ph": 7.2, "wqi": 84.3, "quality": "safe", "ml": { ... } } }
{ "type": "CONNECTED",     "payload": { "clients": 1 } }
```

---

## 🧠 ML Engine

Located at `backend/src/services/mlEngine.js`

| Model | Algorithm | Inputs |
|-------|-----------|--------|
| Contamination Risk | Weighted threshold scoring | pH, turbidity, DO₂, nitrates, conductivity |
| Anomaly Detection | Z-score (15-reading window) | All parameters |
| Scarcity Risk | Temp + DO₂ trend proxy | Temperature, dissolved O₂ |
| WQI Forecast | Linear regression | Historical WQI |

**Swap to AWS SageMaker in production:**
```js
// backend/src/services/mlEngine.js
const AWS = require('aws-sdk');
const sm  = new AWS.SageMakerRuntime({ region: 'ap-south-1' });

async function analyzeReading(reading) {
  const res = await sm.invokeEndpoint({
    EndpointName: process.env.SAGEMAKER_ENDPOINT,
    Body: JSON.stringify(reading),
    ContentType: 'application/json',
  }).promise();
  return JSON.parse(res.Body);
}
```

---

## 🐳 Docker Services

| Container | Image | Port | Role |
|-----------|-------|------|------|
| aquaguard-db | postgres:16-alpine | 5432 | Database |
| aquaguard-backend | node:20-alpine | 5000 | API + WebSocket |
| aquaguard-frontend | nginx:alpine | 80 | React SPA |

```bash
docker-compose up -d --build     # start all
docker-compose logs -f backend   # view logs
docker-compose down              # stop
docker-compose down -v           # stop + delete DB volume
```

---

## ☁️ AWS Deployment (ECS Fargate)

### 1. Create AWS resources

```bash
# ECR repositories
aws ecr create-repository --repository-name aquaguard-backend  --region ap-south-1
aws ecr create-repository --repository-name aquaguard-frontend --region ap-south-1

# ECS cluster
aws ecs create-cluster --cluster-name aquaguard-cluster --region ap-south-1
```

### 2. Set GitHub Secrets

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM key with ECR + ECS permissions |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_ACCOUNT_ID` | Your 12-digit AWS account ID |

### 3. Push to main

```bash
git push origin main
# GitHub Actions → builds Docker images → pushes to ECR → deploys to ECS
```

### Architecture on AWS
```
Internet → Route 53 → ALB
                       ├── /api/*   → ECS: aquaguard-backend  (Fargate)
                       └── /*       → ECS: aquaguard-frontend (Fargate)
                       ↓
                    RDS PostgreSQL  (production DB)
                    SageMaker       (ML inference, optional)
                    CloudWatch      (logs + alerts)
```

---

## 🌍 Monitored Rivers (MVP)

| Sensor | City | River | Region |
|--------|------|-------|--------|
| S001 | Bhopal | Narmada | MP |
| S002 | Delhi | Yamuna | DL |
| S003 | Hyderabad | Godavari | TS |
| S004 | Guwahati | Brahmaputra | AS |
| S005 | Thanjavur | Cauvery | TN |
| S006 | Ahmedabad | Sabarmati | GJ |
| S007 | Rishikesh | Ganga | UK |
| S008 | Vijayawada | Krishna | AP |

---

## 📁 Full Project Structure

```
aquaguard/
├── backend/
│   └── src/
│       ├── index.js                  ← Express + WebSocket server
│       ├── routes/index.js           ← All 15 REST endpoints
│       ├── models/
│       │   ├── store.js              ← In-memory ring-buffer store
│       │   └── db.js                 ← PostgreSQL pool + auto-migration
│       ├── services/
│       │   ├── auth.js               ← JWT register/login middleware
│       │   ├── mlEngine.js           ← 4 ML models
│       │   ├── sensorSimulator.js    ← 5s live data generation
│       │   └── websocket.js          ← WS broadcast service
│       └── utils/logger.js
├── frontend/
│   └── src/
│       ├── App.jsx                   ← Layout + auth guard + nav
│       ├── main.jsx                  ← AuthProvider root
│       ├── index.css                 ← Full design system
│       ├── pages/
│       │   ├── AuthPage.jsx          ← Login + Register UI
│       │   ├── Dashboard.jsx         ← KPIs + WQI chart + sensor grid
│       │   ├── SensorsPage.jsx       ← Sensor detail + live chart
│       │   ├── AlertsPage.jsx        ← Alert management
│       │   ├── MLPage.jsx            ← Risk radar + forecast
│       │   └── AnalyticsPage.jsx     ← Historical analytics
│       ├── hooks/
│       │   ├── useAuth.jsx           ← Auth context + localStorage
│       │   └── useWebSocket.js       ← WS auto-reconnect
│       └── services/api.js           ← Axios client + token injection
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx-spa.conf
├── scripts/
│   └── github-init.sh               ← One-shot GitHub repo setup
├── .github/workflows/deploy.yml     ← CI/CD → AWS ECS
├── docker-compose.yml               ← Full stack incl. PostgreSQL
├── .gitignore
└── README.md
```

---

## 👤 Built by

**Ayush Raj** · B.Tech CSE, RGPV Bhopal · Amdox Technologies Intern  
GitHub: [github.com/ayushraj](https://github.com/ayushraj)

MIT License © 2025
