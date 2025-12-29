// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',  // Cambiar a tu dominio en producción
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;