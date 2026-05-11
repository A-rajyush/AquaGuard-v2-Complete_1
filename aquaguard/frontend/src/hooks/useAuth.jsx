import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem('aq_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('aq_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(d  => { setUser(d.user); setLoading(false); })
      .catch(() => { localStorage.removeItem('aq_token'); localStorage.removeItem('aq_user'); setLoading(false); });
  }, []);

  // Listen for forced logout (401)
  useEffect(() => {
    const handler = () => { setUser(null); };
    window.addEventListener('aq:logout', handler);
    return () => window.removeEventListener('aq:logout', handler);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('aq_token', data.token);
    localStorage.setItem('aq_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await authApi.register(name, email, password);
    localStorage.setItem('aq_token', data.token);
    localStorage.setItem('aq_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('aq_token');
    localStorage.removeItem('aq_user');
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
