import React, { useState, useCallback, useRef } from 'react';
import { Droplets, LayoutDashboard, Radio, AlertTriangle, Brain, BarChart3, Wifi, WifiOff, Bell, LogOut, User } from 'lucide-react';
import { useAuth } from './hooks/useAuth.jsx';
import useWebSocket from './hooks/useWebSocket.js';
import useAlertSound from './hooks/useAlertSound.js';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SensorsPage from './pages/SensorsPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import MLPage from './pages/MLPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'sensors',   label: 'Sensors',    icon: Radio },
  { id: 'alerts',    label: 'Alerts',     icon: AlertTriangle },
  { id: 'ml',        label: 'AI Engine',  icon: Brain },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3 },
];

function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage]           = useState('dashboard');
  const [liveData, setLiveData]   = useState({});
  const [alertCount, setAlertCount] = useState(0);
  const [toast, setToast]         = useState(null);
  const toastTimer = useRef(null);
  const { playAlarm, stopAlarm } = useAlertSound(5000);

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const handleWs = useCallback((msg) => {
    if (msg.type !== 'SENSOR_UPDATE') return;
    const r = msg.payload;
    setLiveData(prev => ({ ...prev, [r.sensorId]: r }));
    if (r.quality === 'critical') {
      setAlertCount(n => n + 1);
      showToast(`🚨 Critical at ${r.sensor?.name || r.sensorId}`, 'critical');
      playAlarm();
    }
  }, [showToast, playAlarm]);

  const connected = useWebSocket(handleWs);
  const props = { liveData, showToast };

  return (
    <div className="flex h-screen bg-grid overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside style={{ width:210, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1976d2,#00d4ff)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Droplets size={17} color="white" />
            </div>
            <div>
              <div className="grad-text" style={{ fontFamily:'var(--ff-mono)', fontWeight:700, fontSize:15 }}>AquaGuard</div>
              <div style={{ fontSize:10, color:'var(--t3)', letterSpacing:'.04em' }}>WATER INTELLIGENCE</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1, padding:'10px 8px', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item${page===id?' active':''}`} onClick={() => setPage(id)}>
              <Icon size={15} />
              <span>{label}</span>
              {id==='alerts' && alertCount>0 && (
                <span style={{ marginLeft:'auto', background:'rgba(255,82,82,.2)', color:'var(--critical)', borderRadius:99, padding:'1px 7px', fontSize:10, fontFamily:'var(--ff-mono)' }}>
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,var(--blue),var(--cyan))', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <User size={13} color="white" />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--t1)', truncate:true, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize:10, color:'var(--t3)', textTransform:'capitalize' }}>{user?.role}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {connected
                ? <><Wifi size={11} color="var(--teal)"/><span style={{ fontSize:10, color:'var(--teal)' }}>Live</span><div className="dot-live" style={{ marginLeft:2 }}/></>
                : <><WifiOff size={11} color="var(--critical)"/><span style={{ fontSize:10, color:'var(--critical)' }}>Offline</span></>}
            </div>
            <button onClick={logout} title="Sign out"
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', padding:4, borderRadius:5, display:'flex', alignItems:'center' }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <header style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'0 20px', height:50, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontWeight:600, fontSize:14 }}>{NAV.find(n=>n.id===page)?.label}</span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontFamily:'var(--ff-mono)', fontSize:11, color:'var(--t3)' }}>
              {new Date().toLocaleTimeString()}
            </span>
            <button onClick={() => { setPage('alerts'); setAlertCount(0); stopAlarm(); }}
              style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:4 }}>
              <Bell size={16} color={alertCount > 0 ? 'var(--critical)' : 'var(--t2)'} />
              {alertCount > 0 && (
                <span style={{ position:'absolute', top:-2, right:-2, background:'var(--critical)', color:'#fff', fontSize:9, borderRadius:99, width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--ff-mono)' }}>
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main style={{ flex:1, overflowY:'auto', padding:20 }}>
          {page==='dashboard'  && <Dashboard   {...props} />}
          {page==='sensors'    && <SensorsPage {...props} />}
          {page==='alerts'     && <AlertsPage  {...props} />}
          {page==='ml'         && <MLPage       {...props} />}
          {page==='analytics'  && <AnalyticsPage {...props} />}
        </main>
      </div>

      {toast && (
        <div className="anim" style={{
          position:'fixed', bottom:24, right:24, zIndex:999,
          background: toast.type==='critical' ? 'rgba(255,52,52,.92)' : 'var(--card)',
          border:`1px solid ${toast.type==='critical' ? 'var(--critical)' : 'var(--border)'}`,
          borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:500,
          backdropFilter:'blur(10px)', color:'var(--t1)', boxShadow:'0 8px 32px rgba(0,0,0,.4)',
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, borderRadius:12, background:'linear-gradient(135deg,#1976d2,#00d4ff)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
          <Droplets size={20} color="white" />
        </div>
        <div style={{ color:'var(--t3)', fontSize:12 }}>Loading AquaGuard…</div>
      </div>
    </div>
  );

  return user ? <AppShell /> : <AuthPage />;
}
