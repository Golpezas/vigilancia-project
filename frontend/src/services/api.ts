// src/services/api.ts
import axios from 'axios';

// Usa .env para entornos (agrega VITE_API_BASE_URL a .env.local para dev)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend-production-d4731.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE_URL, // Ahora: https://domain/api
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json', // Best practice: explícito
  },
});

// Interceptor para logging de errores (observabilidad)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      console.warn('API Error:', error.message, error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;