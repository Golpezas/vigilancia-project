// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { ForbiddenError, ValidationError } from '../utils/errorHandler';
import type { TokenPayload } from '../types/index';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

export const requireAuth = (allowedRoles: ('ADMIN' | 'CLIENT')[] = ['ADMIN', 'CLIENT']) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, 'Intento de acceso sin token');
      throw new ValidationError('Token de autenticación requerido');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      req.user = decoded;

      // Validación multi-cliente (scoping)
      if (decoded.role === 'CLIENT' && req.query.servicioId && req.query.servicioId !== decoded.servicioId) {
        throw new ForbiddenError('Acceso denegado: servicio no autorizado');
      }

      if (!allowedRoles.includes(decoded.role)) {
        throw new ForbiddenError('Rol no autorizado para esta operación');
      }

      next();
    } catch (err: any) {
      const msg = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
      logger.warn({ error: err.message, tokenPrefix: token.slice(0, 8) }, msg);
      throw new ForbiddenError(msg);
    }
  };
};