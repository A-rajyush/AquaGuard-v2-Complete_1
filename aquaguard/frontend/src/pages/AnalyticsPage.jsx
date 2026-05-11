import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { analyticsApi } from '../services/api.js';

export default function AnalyticsPage() {
  const [ov,     setOv]     = useState(null);
  const [wqiHist,setWqiHist]= useState([]);
  const [dist,   setDist]   = useState(null);
  const [trends, setTrends] = useState({});

  const load = useCallback(async () => {
    try {
      const [o, w, d, t] = await Promise.all([
        analyticsApi.overview(),
        analyticsApi.wqiHistory(60),
        analyticsApi.distribution(),
        analyticsApi.paramTrends(),
      ]);
      setOv(o);
      setDist(d.distribution);
      setTrends(t.trend || {});

      // Avg WQI per timestamp
      const allTs = new Set();
      Object.values(w.bySensor || {}).forEach(a => a.forEach(p => allTs.add(p.t)));
      const pts = [...allTs].sort().slice(-30).map(t => {
        const vals = Object.values(w.bySensor || {}).map(a => a.find(p=>p.t===t)?.wqi).filter(Boolean);
        return { t: new Date(t).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}),
                 avg: vals.length ? +(vals.reduce((a,b)=>a+b)/vals.length).toFixed(1) : null };
      });
      setWqiHist(pts);
    } catch {}
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv); }, [load]);

  const distData = dist ? [
    { n:'Safe',     v:dist.safe,     c:'#00e676' },
    { n:'Warning',  v:dist.warning,  c:'#ffab40' },
    { n:'Critical', v:dist.critical, c:'#ff5252' },
  ] : [];

  // Build sparkline data for param trends
  const phData       = (trends.ph       || []).map((y,x) => ({ x, y }));
  const turbData     = (trends.turbidity|| []).map((y,x) => ({ x, y }));
  const wqiTrendData = (trends.wqi      || []).map((y,x) => ({ x, y }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          ['Total Readings', ov?.totalReadings?.toLocaleString(), 'var(--cyan)'],
          ['Online Sensors', `${ov?.onlineSensors ?? '—'} / ${ov?.totalSensors ?? 8}`, 'var(--teal)'],
          ['Avg WQI (last 100)', ov?.avgWQI, 'var(--sky)'],
          ['Critical Rate', `${ov?.criticalRate ?? 0}%`, 'var(--critical)'],
        ].map(([l,v,c]) => (
          <div key={l} className="tile">
            <div className="tile-accent" style={{ background:c }} />
            <div style={{ fontFamily:'var(--ff-mono)', fontSize:24, fontWeight:700, color:c }}>{v ?? '—'}</div>
            <div style={{ fontSize:11, color:'var(--t2)', fontWeight:600, marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
        <div className="card">
          <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>Average WQI — 60 min</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={wqiHist} margin={{top:4,right:4,left:-22,bottom:0}}>
              <XAxis dataKey="t" tick={{fill:'var(--t3)',fontSize:9}} interval="preserveStartEnd" tickLine={false} axisLine={false}/>
              <YAxis domain={[0,100]} tick={{fill:'var(--t3)',fontSize:9}} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11,fontFamily:'var(--ff-mono)'}}/>
              <Line type="monotone" dataKey="avg" stroke="var(--cyan)" strokeWidth={2} dot={false} name="Avg WQI"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Quality Distribution</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={distData} margin={{top:4,right:4,left:-22,bottom:0}}>
              <XAxis dataKey="n" tick={{fill:'var(--t2)',fontSize:11}} tickLine={false} axisLine={false}/>
              <YAxis tick={{fill:'var(--t3)',fontSize:9}} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:11}}/>
              <Bar dataKey="v" name="Count" radius={[5,5,0,0]} barSize={44}>
                {distData.map((d,i) => <Cell key={i} fill={d.c}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Param sparklines */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          ['pH Trend (recent)',       phData,       'var(--cyan)'],
          ['Turbidity Trend (NTU)',   turbData,     '#ffab40'],
          ['WQI Score Trend',         wqiTrendData, 'var(--teal)'],
        ].map(([label, data, color]) => (
          <div key={label} className="card">
            <div style={{ fontWeight:600, fontSize:12, marginBottom:8 }}>{label}</div>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={data} margin={{top:4,right:4,left:-30,bottom:0}}>
                <XAxis dataKey="x" hide/>
                <YAxis tick={{fill:'var(--t3)',fontSize:9}} tickLine={false} axisLine={false} width={30}/>
                <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,fontSize:10}}/>
                <Line type="monotone" dataKey="y" stroke={color} strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* Platform summary table */}
      <div className="card">
        <div style={{ fontWeight:600, fontSize:13, marginBottom:12 }}>Platform Summary</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          {[
            ['Online Sensors',   `${ov?.onlineSensors} / ${ov?.totalSensors}`],
            ['Total Readings',   ov?.totalReadings?.toLocaleString()],
            ['Avg WQI Score',    ov?.avgWQI],
            ['Active Alerts',    ov?.activeAlerts],
            ['Safe Readings',    ov?.safeCount?.toLocaleString()],
            ['Critical Rate',    `${ov?.criticalRate ?? 0}%`],
          ].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', background:'var(--surface)', borderRadius:8, border:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--t3)' }}>{l}</span>
              <span style={{ fontFamily:'var(--ff-mono)', fontSize:13, fontWeight:700, color:'var(--cyan)' }}>{v ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
