import React, { useEffect, useState, useCallback } from 'react';
import { Activity, AlertTriangle, CheckCircle, Droplets, Zap } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { analyticsApi, sensorApi } from '../services/api.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const QUALITY_COLORS = { safe: '#00e676', warning: '#ffab40', critical: '#ff5252' };
const SENSOR_COLORS  = ['#00d4ff','#00e5b0','#29b6f6','#81d4fa','#1976d2','#4fc3f7','#80deea','#b2ebf2'];

function Tile({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="tile anim">
      <div className="tile-accent" style={{ background: accent }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={accent} />
        </div>
      </div>
      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard({ liveData }) {
  const [ov,      setOv]      = useState(null);
  const [history, setHistory] = useState([]);   // chart points
  const [dist,    setDist]    = useState(null);
  const [sensors, setSensors] = useState([]);

  const load = useCallback(async () => {
    try {
      const [o, w, d, s] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.wqiHistory(15),
        analyticsApi.distribution(),
        sensorApi.list(),
      ]);
      setOv(o);
      setDist(d.distribution);
      setSensors(s.sensors || []);

      // Build chart: average WQI per timestamp bucket
      const allTs = new Set();
      Object.values(w.bySensor || {}).forEach(arr => arr.forEach(p => allTs.add(p.t)));
      const sorted = [...allTs].sort().slice(-36);
      const pts = sorted.map(t => {
        const vals = Object.values(w.bySensor || {})
          .map(arr => arr.find(p => p.t === t)?.wqi).filter(Boolean);
        return {
          t: new Date(t).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          avg: vals.length ? +(vals.reduce((a, b) => a + b) / vals.length).toFixed(1) : null,
        };
      });
      setHistory(pts);
    } catch {}
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [load]);

  // Merge live into sensors
  const enriched = sensors.map(s => ({ ...s, live: liveData[s.id] }));

  const pieData = dist ? [
    { name: 'Safe',     value: dist.safe,     color: '#00e676' },
    { name: 'Warning',  value: dist.warning,  color: '#ffab40' },
    { name: 'Critical', value: dist.critical, color: '#ff5252' },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <Tile label="Online Sensors"  value={ov?.onlineSensors}  sub={`of ${ov?.totalSensors ?? 8}`}        icon={Activity}      accent="var(--cyan)" />
        <Tile label="Avg WQI"         value={ov?.avgWQI}         sub="WHO threshold ≥ 70"                   icon={Droplets}      accent="var(--teal)" />
        <Tile label="Active Alerts"   value={ov?.activeAlerts}   sub="Unresolved incidents"                 icon={AlertTriangle} accent={ov?.activeAlerts > 0 ? 'var(--critical)' : 'var(--safe)'} />
        <Tile label="Safe Readings"   value={ov?.safeCount}      sub={`${ov?.criticalRate ?? 0}% critical`} icon={CheckCircle}   accent="var(--safe)" />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>

        {/* WQI trend */}
        <div className="card anim anim-d1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Live WQI Trend — 15 min</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--cyan)',
                           background: 'rgba(0,212,255,.1)', padding: '2px 8px', borderRadius: 99 }}>
              <Zap size={10} /> LIVE
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="wqiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fill: 'var(--t3)', fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--t3)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--ff-mono)' }} />
              <Area type="monotone" dataKey="avg" stroke="#00d4ff" strokeWidth={2} fill="url(#wqiGrad)" dot={false} name="Avg WQI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quality distribution */}
        <div className="card anim anim-d2" style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Quality Split</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} dataKey="value" strokeWidth={0}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              {pieData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--t2)' }}>{d.name}</span>
                  <span style={{ fontFamily: 'var(--ff-mono)', color: d.color, fontWeight: 700 }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sensor grid */}
      <div className="anim anim-d3">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Sensor Network — Live</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {enriched.map((s, i) => {
            const q   = s.live?.quality || 'safe';
            const wqi = s.live?.wqi;
            return (
              <div key={s.id} className={`card glow-${q}`} style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{s.city}, {s.region}</div>
                  </div>
                  <span className={`badge badge-${q}`}>{q}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
                  {[['WQI', wqi?.toFixed(1)], ['pH', s.live?.ph?.toFixed(1)], ['NTU', s.live?.turbidity?.toFixed(1)]].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--surface)', borderRadius: 7, padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 13, fontWeight: 700, color: SENSOR_COLORS[i % SENSOR_COLORS.length] }}>{v ?? '—'}</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {s.live?.mlPrediction?.recommendation && (
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--t3)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                    {s.live.mlPrediction.recommendation.icon}{' '}
                    {s.live.mlPrediction.recommendation.action.slice(0, 70)}…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
