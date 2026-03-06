// src/utils/api.js
import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 60000 });
api.interceptors.request.use(c => { const t = localStorage.getItem('dv_token'); if(t) c.headers.Authorization=`Bearer ${t}`; return c; });
api.interceptors.response.use(r => r, err => {
  if(err.response?.status===401){ localStorage.removeItem('dv_token'); localStorage.removeItem('dv_admin'); window.location.href='/login'; }
  return Promise.reject(err);
});
export default api;
