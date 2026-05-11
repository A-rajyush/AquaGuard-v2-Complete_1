import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Clock, AlertTriangle, Filter } from 'lucide-react';
import { alertApi } from '../services/api.js';

const SEV_COLOR = { critical: '#ff5252', high: '#ffab40', medium: '#ffd740', low: '#00e5b0' };

export default function AlertsPage({ showToast }) {
  const [alerts,  setAlerts]  = useState([]);
  const [filter,  setFilter]  = useState('active');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await alertApi.list({ limit: 200 });
      setAlerts(d.alerts || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 6000); return () => clearInterval(iv); }, [load]);

  const resolve = async (id) => {
    try {
      await alertApi.resolve(id);
      showToast?.('✓ Alert resolved', 'info');
      load();
    } catch { showToast?.('Failed to resolve', 'error'); }
  };

  const shown = filter === 'all'      ? alerts
              : filter === 'active'   ? alerts.filter(a => !a.resolved)
              : alerts.filter(a => a.resolved);

  const counts = {
    total:    alerts.length,
    active:   alerts.filter(a => !a.resolved).length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    resolved: alerts.filter(a =>  a.resolved).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {[['Total', counts.total, 'var(--cyan)'], ['Active', counts.active, 'var(--critical)'],
          ['Critical', counts.critical, '#ff5252'], ['Resolved', counts.resolved, 'var(--safe)']].map(([l, v, c]) => (
          <div key={l} className="tile" style={{ textAlign: 'center' }}>
            <div className="tile-accent" style={{ background: c }} />
            <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 28, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginTop: 4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Filter size={13} color="var(--t3)" />
        {['active','all','resolved'].map(f => (
          <button key={f} className="btn" onClick={() => setFilter(f)}
            style={{ borderColor: filter === f ? 'var(--cyan)' : undefined, color: filter === f ? 'var(--cyan)' : undefined, textTransform: 'capitalize' }}>
            {f} {f === 'active' ? `(${counts.active})` : f === 'resolved' ? `(${counts.resolved})` : `(${counts.total})`}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>
          {loading ? 'Refreshing…' : 'Auto-refresh 6s'}
        </span>
      </div>

      {/* Alert list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {shown.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <CheckCircle size={36} color="var(--teal)" style={{ margin: '0 auto 10px' }} />
            <div style={{ color: 'var(--t2)', fontWeight: 500 }}>No alerts — all clear</div>
          </div>
        )}
        {shown.map(a => (
          <div key={a.id} className="card anim" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', opacity: a.resolved ? 0.58 : 1, padding: 14 }}>
            {/* Severity indicator */}
            <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: SEV_COLOR[a.severity] || 'var(--t3)', flexShrink: 0 }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>{a.sensorName}</span>
                <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, padding: '1px 7px', borderRadius: 99,
                               background: `${SEV_COLOR[a.severity]}22`, color: SEV_COLOR[a.severity] }}>
                  {a.severity?.toUpperCase()}
                </span>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99,
                               background: 'var(--surface)', color: 'var(--t3)', border: '1px solid var(--border)' }}>
                  {a.type}
                </span>
                {a.resolved && (
                  <span style={{ fontSize: 10, color: 'var(--safe)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <CheckCircle size={10} /> Resolved
                  </span>
                )}
                {a.wqi != null && (
                  <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 10, color: 'var(--t3)' }}>
                    WQI: <span style={{ color: 'var(--cyan)' }}>{a.wqi}</span>
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{a.message}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 10, color: 'var(--t3)' }}>
                <Clock size={9} />
                {new Date(a.createdAt).toLocaleString()}
                {a.resolvedAt && <span style={{ marginLeft: 8 }}>· Resolved {new Date(a.resolvedAt).toLocaleTimeString()}</span>}
              </div>
            </div>

            {!a.resolved && (
              <button className="btn" onClick={() => resolve(a.id)}
                style={{ flexShrink: 0, borderColor: 'rgba(0,230,118,.3)', color: 'var(--safe)', background: 'rgba(0,230,118,.08)' }}>
                Resolve
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
