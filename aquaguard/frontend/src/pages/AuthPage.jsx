import React, { useState } from 'react';
import { Droplets, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode,    setMode]    = useState('login');   // 'login' | 'register'
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [showPw,  setShowPw]  = useState(false);
  const [err,     setErr]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, pass);
      } else {
        if (!name.trim()) { setErr('Name is required'); setLoading(false); return; }
        await register(name, email, pass);
      }
    } catch (e) {
      setErr(e?.error || e?.message || 'Something went wrong');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }} className="bg-grid">

      {/* Glow blobs */}
      <div style={{ position:'absolute', top:'15%', left:'20%', width:320, height:320, borderRadius:'50%',
                    background:'radial-gradient(circle,rgba(0,212,255,.08),transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'15%', right:'20%', width:280, height:280, borderRadius:'50%',
                    background:'radial-gradient(circle,rgba(0,229,176,.06),transparent 70%)', pointerEvents:'none' }}/>

      <div className="anim" style={{ width:'100%', maxWidth:420, padding:'0 16px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:16, margin:'0 auto 14px',
                        background:'linear-gradient(135deg,#1976d2,#00d4ff)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:'0 0 32px rgba(0,212,255,.3)' }}>
            <Droplets size={26} color="white" />
          </div>
          <div className="grad-text" style={{ fontFamily:'var(--ff-mono)', fontWeight:700, fontSize:22 }}>AquaGuard</div>
          <div style={{ color:'var(--t3)', fontSize:12, marginTop:4 }}>Water Intelligence Platform</div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding:28 }}>

          {/* Mode tabs */}
          <div style={{ display:'flex', marginBottom:24, background:'var(--surface)', borderRadius:9, padding:3 }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(''); }}
                style={{ flex:1, padding:'8px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, transition:'all .15s',
                         background: mode===m ? 'var(--border-hi)' : 'transparent',
                         color: mode===m ? 'var(--cyan)' : 'var(--t3)' }}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

            {mode === 'register' && (
              <div>
                <label style={{ fontSize:11, color:'var(--t3)', display:'block', marginBottom:5 }}>Full Name</label>
                <input type="text" placeholder="Ayush Raj" value={name} onChange={e=>setName(e.target.value)}
                  style={{ width:'100%' }} required />
              </div>
            )}

            <div>
              <label style={{ fontSize:11, color:'var(--t3)', display:'block', marginBottom:5 }}>Email Address</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}
                style={{ width:'100%' }} required />
            </div>

            <div>
              <label style={{ fontSize:11, color:'var(--t3)', display:'block', marginBottom:5 }}>Password</label>
              <div style={{ position:'relative' }}>
                <input type={showPw ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={pass} onChange={e=>setPass(e.target.value)}
                  style={{ width:'100%', paddingRight:38 }} required minLength={8} />
                <button type="button" onClick={() => setShowPw(p=>!p)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                           background:'none', border:'none', cursor:'pointer', color:'var(--t3)', padding:0 }}>
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>

            {err && (
              <div style={{ background:'rgba(255,82,82,.12)', border:'1px solid rgba(255,82,82,.3)',
                            borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--critical)' }}>
                ⚠ {err}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', fontSize:14, marginTop:4 }}>
              {loading ? <><Loader size={14} style={{ animation:'spin 1s linear infinite' }}/> Please wait…</>
                       : mode === 'login' ? '→ Sign In' : '→ Create Account'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop:18, padding:'10px 14px', background:'var(--surface)', borderRadius:8,
                        border:'1px solid var(--border)', fontSize:11 }}>
            <div style={{ color:'var(--t3)', marginBottom:4, fontWeight:600 }}>Quick Demo</div>
            <div style={{ color:'var(--t2)' }}>
              Register any email/password to get started instantly.
              No DB required — uses in-memory store.
            </div>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--t3)' }}>
          Monitoring 8 Indian river stations · Real-time AI analysis
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
