// src/app.ts
import express, { Request, Response, NextFunction } from 'express'; // Type-safety explícito
import cors from 'cors';
import helmet from 'helmet';
import vigiladorRoutes from './routes/vigiladorRoutes';
import { AppError } from './utils/errorHandler';
import logger from './utils/logger'; // Logger centralizado Pino

const app = express();

// Puerto normalizado con fallback seguro
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middlewares (seguridad + parsing escalable)
app.use(helmet());
app.use(cors({
  origin: '*', // TODO: Restringir en prod a dominios específicos
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rutas desacopladas
app.use('/api', vigiladorRoutes);

// Health check con logging estructurado
app.get('/', (req: Request, res: Response) => {
  const response = {
    message: 'API Vigilancia QR - Backend corriendo correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  };
  // ← Orden correcto: objeto primero (mergeado en log), mensaje segundo
  logger.info({ response }, '🔍 Health check accedido');
  res.json(response);
});

// Handler global de errores (centralizado + structured)
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const context = {
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    errorMessage: (err instanceof Error ? err.message : 'Error desconocido'),
    stack: (err instanceof Error ? err.stack : undefined)
  };
  // ← Objeto estructurado primero
  logger.error(context, '🚨 Error global no manejado');

  if (err instanceof AppError) {
    return res.status(err.statusCode || 500).json({
      error: err.message
    });
  }

  res.status(500).json({
    error: 'Error interno del servidor'
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  // ← Objeto primero
  logger.warn({ path: req.path, method: req.method }, '⚠️ Ruta no encontrada');
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
});

// Startup con logging
app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, '🚀 Servidor backend corriendo en puerto');
  if (process.env.NODE_ENV !== 'production') {
    logger.debug({ url: `http://localhost:${PORT}` }, '🔗 Acceso local');
  }
});

export default app;