// src/app.ts
import express, { Request, Response, NextFunction } from 'express'; // Type-safety explícito
import cors from 'cors';
import helmet from 'helmet';
import vigiladorRoutes from './routes/vigiladorRoutes';
import { AppError } from './utils/errorHandler';
import logger from './utils/logger'; // Logger centralizado Pino
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';

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

app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRoutes); // ← Nueva ruta protegida

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
    errorMessage: err instanceof Error ? err.message : 'Error desconocido',
    stack: err instanceof Error ? err.stack : undefined,
  };

  // Usa child logger para context adicional (best practice Pino: no sobreescribir global)
  const errorLogger = logger.child({ reqId: req.headers['x-request-id'] || 'unknown' }); // Opcional reqId para traceability
  errorLogger.error(context, '🚨 Error global no manejado');

  let status = 500;
  let message = 'Error interno del servidor';

  if (err instanceof AppError) {
    status = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    // Fallback para errores genéricos (normalización)
    message = err.message;
  }

  res.status(status).json({ error: message });
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