// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || 'https://backend-production-d4731.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de requests (ya lo tenías, está bien)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Opcional pero muy útil para debug en desarrollo:
if (import.meta.env.DEV) {
  api.interceptors.request.use(config => {
    // Usamos optional chaining + fallback para evitar undefined
    const base = config.baseURL ?? '';
    const path = config.url ?? '';

    const fullUrl = base && path ? `${base}${path.startsWith('/') ? '' : '/'}${path}` : '—';

    console.log('[API Request]', {
      method: config.method?.toUpperCase() ?? 'UNKNOWN',
      fullUrl,
      data: config.data,
    });

    return config;
  });

  api.interceptors.response.use(
    response => {
      console.log('[API Success]', response.status, response.data);
      return response;
    },
    error => {
      console.error('[API Error]', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );
}

export default api;