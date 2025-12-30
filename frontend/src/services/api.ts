// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'backend-production-d4731.up.railway.app', // ← URL Railway pública
  timeout: 10000,
});

export default api;