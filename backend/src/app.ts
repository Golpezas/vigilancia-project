// src/app.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import vigiladorRoutes from './routes/vigiladorRoutes';
import { AppError } from './utils/errorHandler';

const app = express();

// ¡Corrección aquí!
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middlewares...
app.use(helmet());
app.use(cors({
  origin: '*', // TODO: restringir en producción
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rutas...
app.use('/api', vigiladorRoutes);

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor backend corriendo en puerto ${PORT}`);
  console.log(`📊 Prisma Studio: npx prisma studio`);
});

export default app;