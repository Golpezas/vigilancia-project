// frontend/src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://backend-production-d4731.up.railway.app/api',  // ← Protocolo + /api
  timeout: 10000,
});

export default api;

