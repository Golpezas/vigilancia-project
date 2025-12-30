// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://tu-backend.up.railway.app/api',  // Cambiar a tu dominio en producción
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;