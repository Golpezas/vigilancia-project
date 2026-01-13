// src/services/api.ts
import axios from 'axios';

// Usa .env para entornos
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend-production-d4731.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  res => res,
  err => {
    console.error('🚨 API Error:', { url: err.config?.url, message: err.message, response: err.response?.data });
    return Promise.reject(err.response?.data?.error || 'Error de conexión - verifique red o auth');
  }
);

export default api;