import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, Battery, Wifi, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { sensorApi } from '../services/api.js';

const PARAMS = [
  { key: 'ph',          label: 'pH',           color: '#00d4ff', unit: '' },
  { key: 'turbidity',   label: 'Turbidity',    color: '#ffab40', unit: 'NTU' },
  { key: 'temperature', label: 'Temp',         color: '#ff5252', unit: '°C' },
  { key: 'dissolvedO2', label: 'DO₂',          color: '#00e5b0', unit: 'mg/L' },
  { key: 'conductivity',label: 'Conductivity', color: '#29b6f6', unit: 'µS/cm' },
  { key: 'nitrates',    label: 'Nitrates',     color: '#ff8a65', unit: 'mg/L' },
];

export default function SensorsPage({ liveData }) {
  const [sensors,  setSensors]  = useState([]);
  const [selId,    setSelId]    = useState(null);
  const [readings, setReadings] = useState([]);
  const [loading,  setLoading]  = useState(false);

  // Load sensor list
  useEffect(() => {
    sensorApi.list().then(d => {
      setSensors(d.sensors || []);
      if (d.sensors?.[0]) setSelId(d.sensors[0].id);
    }).catch(() => {});
  }, []);

  // Load readings when sensor selected
  const loadReadings = useCallback(async () => {
    if (!selId) return;
    setLoading(true);
    try {
      const d = await sensorApi.readings(selId, 40);
      setReadings(d.readings || []);
    } catch {}
    setLoading(false);
  }, [selId]);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  // Append live data
  useEffect(() => {
    if (!selId || !liveData[selId]) return;
    setReadings(prev => {
      const exists = prev.some(r => r.id === liveData[selId].id);
      if (exists) return prev;
      return [...prev, liveData[selId]].slice(-40);
    });
  }, [liveData, selId]);

  const chartData = readings.map(r => ({
    t: new Date(r.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ph: r.ph, turbidity: r.turbidity, wqi: r.wqi,
    dissolvedO2: r.dissolvedO2, temperature: r.temperature,
  }));

  const live  = selId ? liveData[selId] : null;
  const selSensor = sensors.find(s => s.id === selId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Sensor selector grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {sensors.map(s => {
          const q = liveData[s.id]?.quality || 'safe';
          return (
            <button key={s.id} onClick={() => setSelId(s.id)}
              className={`card${selId === s.id ? ' glow-safe' : ''}`}
              style={{ textAlign: 'left', cursor: 'pointer', borderColor: selId === s.id ? 'var(--cyan)' : undefined, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div className="dot-live" style={{ background: q === 'safe' ? 'var(--teal)' : q === 'warning' ? 'var(--warning)' : 'var(--critical)' }} />
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--t3)' }}>{s.id}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{s.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 10, color: 'var(--t3)' }}>
                <MapPin size={9} />{s.city}, {s.region}
              </div>
              <span className={`badge badge-${q}`} style={{ marginTop: 6 }}>{q}</span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selSensor && (
        <div className="card anim">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{selSensor.name}</div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{selSensor.city}, {selSensor.region} · Firmware {selSensor.firmware}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--t2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Wifi size={12} />Online</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Battery size={12} />{selSensor.batteryLevel?.toFixed(0)}%</span>
              <button className="btn" onClick={loadReadings} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>

          {/* Live parameter tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 14 }}>
            {PARAMS.map(p => (
              <div key={p.key} style={{ background: 'var(--surface)', borderRadius: 9, padding: '10px 8px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 17, fontWeight: 700, color: p.color }}>
                  {live?.[p.key]?.toFixed(2) ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 3 }}>{p.label}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>{p.unit}</div>
              </div>
            ))}
          </div>

          {/* WQI + param chart */}
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <XAxis dataKey="t" tick={{ fill: 'var(--t3)', fontSize: 9 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--t3)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--ff-mono)' }} />
              <Legend wrapperStyle={{ fontSize: 10, color: 'var(--t2)' }} />
              <Line type="monotone" dataKey="wqi"        name="WQI"       stroke="#00d4ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ph"         name="pH"        stroke="#00e5b0" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="turbidity"  name="Turbidity" stroke="#ffab40" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="dissolvedO2"name="DO₂"       stroke="#29b6f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>

          {/* ML recommendation */}
          {live?.mlPrediction?.recommendation && (
            <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 9, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan)', marginBottom: 4 }}>
                AI Recommendation — Priority: {live.mlPrediction.recommendation.priority}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                {live.mlPrediction.recommendation.icon} {live.mlPrediction.recommendation.action}
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 8, fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--t3)' }}>
                  Contamination: <span style={{ color: '#ffab40' }}>{(live.mlPrediction.contamination_risk * 100).toFixed(1)}%</span>
                </span>
                <span style={{ color: 'var(--t3)' }}>
                  Anomaly: <span style={{ color: '#29b6f6' }}>{(live.mlPrediction.anomaly_score * 100).toFixed(1)}%</span>
                </span>
                <span style={{ color: 'var(--t3)' }}>
                  Scarcity: <span style={{ color: 'var(--teal)' }}>{(live.mlPrediction.scarcity_risk * 100).toFixed(1)}%</span>
                </span>
                <span style={{ color: 'var(--t3)' }}>
                  Confidence: <span style={{ color: 'var(--cyan)' }}>{(live.mlPrediction.confidence * 100).toFixed(1)}%</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
