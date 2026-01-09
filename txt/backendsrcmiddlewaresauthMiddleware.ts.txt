// src/middlewares/authMiddleware.ts
// Middleware JWT para autenticación multi-cliente - Mejores prácticas 2026: Verificación estricta, logging Pino, errores normalizados
// Dependencias: jsonwebtoken v9+ (type-safe con @types)
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { ForbiddenError, ValidationError } from '../utils/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'; // ← En .env: JWT_SECRET=tu_clave_secreta_fuerte

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ path: req.path, ip: req.ip }, '⚠️ Acceso sin token');
    throw new ValidationError('Token de autenticación requerido');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { servicioId: string; userId: string }; // Type assertion segura
    req.user = decoded; // Adjunta al request (type-safety: extiende Request en types/express.d.ts si necesitas global)
    if (req.query.servicioId && req.query.servicioId !== decoded.servicioId) {
      throw new ForbiddenError('Acceso denegado: servicio no autorizado');
    }
    logger.info({ userId: decoded.userId, servicioId: decoded.servicioId }, '✅ Autenticación JWT exitosa');
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido en JWT';
    logger.error({ err: message, tokenSnippet: token.slice(0, 10) + '...' }, '🚨 Error en autenticación JWT');
    if (err instanceof jwt.TokenExpiredError) {
      throw new ForbiddenError('Token expirado');
    }
    throw new ForbiddenError('Token inválido');
  }
};