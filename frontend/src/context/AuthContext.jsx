// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
const C = createContext(null);
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem('dv_token');
    const saved = localStorage.getItem('dv_admin');
    if (token && saved) {
      setAdmin(JSON.parse(saved));
      api.get('/auth/verify').then(r => setAdmin(r.data.admin)).catch(() => { localStorage.clear(); setAdmin(null); }).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('dv_token', data.token);
    localStorage.setItem('dv_admin', JSON.stringify(data.admin));
    setAdmin(data.admin);
  };
  const logout = () => { localStorage.removeItem('dv_token'); localStorage.removeItem('dv_admin'); setAdmin(null); };
  return <C.Provider value={{ admin, login, logout, loading }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
