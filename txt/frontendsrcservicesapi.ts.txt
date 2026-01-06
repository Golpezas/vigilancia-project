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

// Interceptor útil para dev
api.interceptors.response.use(
  (response) => {
    console.log('🔗 Respuesta API:', { url: response.config.url, status: response.status });
    return response;
  },
  (error) => {
    console.error('🚨 Error API:', {
      url: error.config?.url,
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    return Promise.reject(error);
  }
);

export default api;