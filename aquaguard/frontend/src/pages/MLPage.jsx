import React, { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend
} from 'recharts';
import { mlApi, sensorApi } from '../services/api.js';

export default function MLPage({ liveData }) {
  const [sensors,  setSensors]  = useState([]);
  const [selId,    setSelId]    = useState(null);
  const [forecast, setForecast] = useState([]);
  const [summary,  setSummary]  = useState([]);

  useEffect(() => {
    Promise.all([sensorApi.list(), mlApi.riskSummary()])
      .then(([s, r]) => {
        setSensors(s.sensors || []);
        setSummary(r.summary || []);
        if (s.sensors?.[0]) setSelId(s.sensors[0].id);
      }).catch(() => {});
    const iv = setInterval(() => {
      mlApi.riskSummary().then(r => setSummary(r.summary || [])).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!selId) return;
    mlApi.forecast(selId).then(d => setForecast(d.forecast || [])).catch(() => {});
  }, [selId]);

  const live = selId ? liveData[selId] : null;
  const ml   = live?.mlPrediction;

  const radarData = ml ? [
    { s: 'Contamination', v: +(ml.contamination_risk * 100).toFixed(1) },
    { s: 'Scarcity',      v: +(ml.scarcity_risk      * 100).toFixed(1) },
    { s: 'Anomaly',       v: +(ml.anomaly_score       * 100).toFixed(1) },
    { s: 'WQI',           v: live?.wqi || 0 },
    { s: 'Confidence',    v: +(ml.confidence         * 100).toFixed(1) },
  ] : [];

  const barData = summary.map(s => ({
    id:   s.sensorId,
    risk: +((s.contamination_risk + s.anomaly_score) / 2 * 100).toFixed(1),
    wqi:  s.wqi || 0,
  }));

  const Trend = ({ v }) => v === 'rising'
    ? <span style={{ color: '#ff5252', display:'flex',alignItems:'center',gap:3 }}><TrendingUp size={12}/>Rising</span>
    : v === 'falling'
    ? <span style={{ color:'#00e5b0', display:'flex',alignItems:'center',gap:3 }}><TrendingDown size={12}/>Falling</span>
    : <span style={{ color:'var(--t3)', display:'flex',alignItems:'center',gap:3 }}><Minus size={12}/>Stable</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
        <Brain size={18} color="var(--cyan)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>AI / ML Engine — Model v1.4.0</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>Statistical contamination, anomaly & scarcity models · SageMaker-ready</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>

        {/* Radar + selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <select value={selId || ''} onChange={e => setSelId(e.target.value)} style={{ width: '100%' }}>
            {sensors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Risk Profile</div>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="s" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                <Radar dataKey="v" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.18} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>

            {ml && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['Contamination', (ml.contamination_risk*100).toFixed(1)+'%', '#ffab40'],
                    ['Anomaly',       (ml.anomaly_score*100).toFixed(1)+'%',       '#29b6f6'],
                    ['Scarcity',      (ml.scarcity_risk*100).toFixed(1)+'%',       '#00e5b0'],
                    ['Confidence',    (ml.confidence*100).toFixed(1)+'%',          '#00d4ff'],
                  ].map(([l,v,c]) => (
                    <div key={l} style={{ background:'var(--surface)', borderRadius:7, padding:'7px 9px' }}>
                      <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, fontWeight:700, color:c }}>{v}</div>
                      <div style={{ fontSize:9, color:'var(--t3)', marginTop:2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:10, background:'var(--surface)', borderRadius:9, padding:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--cyan)', marginBottom:4 }}>
                    {ml.recommendation?.icon} Recommendation
                  </div>
                  <div style={{ fontSize:11, color:'var(--t2)', lineHeight:1.5 }}>{ml.recommendation?.action}</div>
                  <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8, fontSize:10 }}>
                    <span style={{ color:'var(--t3)' }}>WQI Trend:</span>
                    <Trend v={ml.wqi_trend} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Forecast */}
          {forecast.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>24h WQI Forecast</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${forecast.length},1fr)`, gap: 6 }}>
                {forecast.map(f => (
                  <div key={f.hours_ahead} style={{ background:'var(--surface)', borderRadius:7, padding:'8px 4px', textAlign:'center' }}>
                    <div style={{ fontFamily:'var(--ff-mono)', fontSize:14, fontWeight:700,
                                  color: f.wqi > 70 ? 'var(--safe)' : f.wqi > 50 ? 'var(--warning)' : 'var(--critical)' }}>
                      {f.wqi}
                    </div>
                    <div style={{ fontSize:9, color:'var(--t3)', marginTop:2 }}>+{f.hours_ahead}h</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Network risk bar */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Network Risk Overview — All Sensors</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="id" tick={{ fill:'var(--t3)', fontSize:9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0,100]} tick={{ fill:'var(--t3)', fontSize:9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, fontFamily:'var(--ff-mono)' }} />
              <Legend wrapperStyle={{ fontSize:10, color:'var(--t2)' }} />
              <Bar dataKey="risk" name="Risk %" barSize={14} radius={[4,4,0,0]}>
                {barData.map((d,i) => (
                  <Cell key={i} fill={d.risk>60?'#ff5252':d.risk>30?'#ffab40':'#00e5b0'} />
                ))}
              </Bar>
              <Bar dataKey="wqi" name="WQI" barSize={14} fill="var(--blue)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary table */}
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--t2)', marginBottom: 8 }}>Per-Sensor Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {summary.map(s => (
                <div key={s.sensorId} style={{ background:'var(--surface)', borderRadius:8, padding:'8px 10px', border:'1px solid var(--border)' }}>
                  <div style={{ fontFamily:'var(--ff-mono)', fontSize:10, color:'var(--t3)', marginBottom:3 }}>{s.sensorId}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--t1)', marginBottom:4 }}>
                    WQI: <span style={{ color:'var(--cyan)' }}>{s.wqi?.toFixed(1)}</span>
                  </div>
                  <span className={`badge badge-${s.quality || 'safe'}`} style={{ fontSize:9 }}>{s.quality}</span>
                  {s.recommendation && (
                    <div style={{ fontSize:9, color:'var(--t3)', marginTop:4, lineHeight:1.4 }}>
                      {s.recommendation.icon} {s.recommendation.priority}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
