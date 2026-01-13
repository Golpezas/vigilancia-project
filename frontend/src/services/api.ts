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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default api;