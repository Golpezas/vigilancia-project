// src/app.ts
// Servidor Express principal - Configuración segura, modular y moderna (best practices 2025)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import vigiladorRoutes from './routes/vigiladorRoutes'; // ← .js
import { AppError } from './utils/errorHandler'; // ← .js

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de seguridad y parsing
app.use(helmet()); // Cabeceras de seguridad OWASP
app.use(cors({
  origin: '*', // En producción: restringir a tu dominio frontend (e.g., 'http://localhost:5173')
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Soporte para payloads grandes (geo, etc.)

// Rutas API
app.use('/api', vigiladorRoutes);

// Ruta de salud / bienvenida
app.get('/', (req, res) => {
  res.json({
    message: 'API Vigilancia QR - Backend corriendo correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Manejo global de errores custom
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode || 500).json({
      error: err.message
    });
  }

  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

// 404 - Ruta no encontrada
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  console.log(`📊 Prisma Studio: npx prisma studio`);
});

export default app;