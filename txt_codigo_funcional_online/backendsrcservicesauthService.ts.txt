// backend/src/services/authService.ts
// Servicio de autenticación multi-rol - Mejores prácticas 2026: JWT scoping por servicio, bcrypt v6+, Zod runtime validation
// Type-safety estricta: narrowing explícito para env vars, no any/unknown sin guards
// Logging Pino estructurado (objeto primero), errores normalizados, JSDoc completo

import { prisma } from '../repositories/vigiladorRepository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import logger from '../utils/logger';
import { ValidationError, ForbiddenError } from '../utils/errorHandler';
import type { TokenPayload } from '../types/index';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET_RAW = process.env.JWT_SECRET;

if (!JWT_SECRET_RAW || JWT_SECRET_RAW.length < 48) {
  const errorContext = {
    envVar: 'JWT_SECRET',
    length: JWT_SECRET_RAW?.length ?? 0,
    isSet: !!JWT_SECRET_RAW,
  };
  logger.error(errorContext, '🚨 JWT_SECRET no configurado o demasiado débil (mínimo 48 caracteres seguros)');
  throw new Error('Error de configuración crítica: JWT_SECRET inválido o ausente - Verifica .env y reinicia');
}

// Narrowing explícito post-check (resuelve TS2769: TS ahora ve string garantizado)
const JWT_SECRET: string = JWT_SECRET_RAW;

const SALT_ROUNDS = 12;

// Esquemas Zod para entrada segura (normalización + mensajes custom)
const RegisterSchema = z.object({
  email: z.string().email('Email inválido').min(5),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['ADMIN', 'CLIENT']).optional().default('CLIENT'),
});

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

// Tipo del payload del JWT – usa extends para escalabilidad
export interface TokenPayloadExtended extends TokenPayload {
  servicioId?: string; // Scoping para CLIENT – inferido de DB
}

/**
 * Registra un nuevo usuario con rol y scoping servicio opcional.
 * @param data Datos validados (email, password, role?)
 * @returns Usuario creado sin password (seguridad)
 * @throws ValidationError si duplicado/inválido
 */
export async function registerUser(data: unknown) {
  const parsed = RegisterSchema.parse(data); // Throw ZodError si inválido

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.email.toLowerCase() }, // Normalización: lowercase para uniqueness
  });

  if (existingUser) {
    logger.warn({ email: parsed.email }, '⚠️ Intento de registro duplicado');
    throw new ValidationError('Email ya registrado');
  }

  const hashedPassword = await bcrypt.hash(parsed.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: parsed.email.toLowerCase(),
      password: hashedPassword,
      role: parsed.role,
    },
    select: { id: true, email: true, role: true }, // Excluye password (best practice)
  });

  logger.info({ userId: user.id, role: user.role }, '✅ Usuario registrado exitosamente');

  return user;
}

/**
 * Autentica usuario y genera JWT con scoping.
 * @param data Datos validados (email, password)
 * @returns { token: string }
 * @throws ForbiddenError si credenciales inválidas
 */
export async function loginUser(data: unknown) {
  const parsed = LoginSchema.parse(data);

  const user = await prisma.user.findUnique({
    where: { email: parsed.email.toLowerCase() },
    include: { servicio: true }, // Include para scoping CLIENT
  });

  if (!user) {
    logger.warn({ email: parsed.email }, '⚠️ Login fallido: usuario no encontrado');
    throw new ForbiddenError('Credenciales inválidas');
  }

  const passwordMatch = await bcrypt.compare(parsed.password, user.password);
  if (!passwordMatch) {
    logger.warn({ userId: user.id }, '⚠️ Login fallido: contraseña incorrecta');
    throw new ForbiddenError('Credenciales inválidas');
  }

  // Payload con scoping: servicioId solo para CLIENT
  const payload: TokenPayloadExtended = {
    id: user.id,
    email: user.email,
    role: user.role,
    ...(user.role === 'CLIENT' && user.servicioId ? { servicioId: user.servicioId } : {}),
  };

  // Firma segura: expiresIn normalizado, algoritmo default HS256 (seguro para secrets fuertes)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

  logger.info({ userId: user.id, role: user.role, servicioId: payload.servicioId }, '✅ Login exitoso - JWT generado');

  return { token };
}

/**
 * Middleware factory para autenticación por roles.
 * @param allowedRoles Roles permitidos (e.g., ['ADMIN'])
 * @returns Middleware Express con type-safety (augmenta req.user)
 */
export function authMiddleware(allowedRoles: Array<'ADMIN' | 'CLIENT'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn({ path: req.path, ip: req.ip }, '⚠️ Acceso sin token');
      return res.status(401).json({ error: 'Token requerido' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayloadExtended;

      // Validación scoping: para CLIENT, verifica servicioId en query/body
      if (decoded.role === 'CLIENT') {
        const servicioIdFromReq = req.query.servicioId || req.body.servicioId;
        if (servicioIdFromReq && servicioIdFromReq !== decoded.servicioId) {
          logger.warn({ userId: decoded.id, attemptedServicio: servicioIdFromReq }, '⚠️ Scoping violado');
          throw new ForbiddenError('Acceso denegado: servicio no autorizado');
        }
      }

      if (!allowedRoles.includes(decoded.role)) {
        logger.warn({ attemptedRole: decoded.role, userId: decoded.id }, '⚠️ Rol no autorizado');
        throw new ForbiddenError('Acceso denegado - rol insuficiente');
      }

      req.user = decoded; // Type-safe gracias a express.d.ts
      logger.info({ userId: decoded.id, role: decoded.role, path: req.path }, '✅ Autenticación JWT exitosa');

      next();
    } catch (err: unknown) {
      let message: string;
      if (err instanceof jwt.TokenExpiredError) {
        message = 'Token expirado';
      } else if (err instanceof jwt.JsonWebTokenError) {
        message = 'Token inválido';
      } else {
        message = 'Error de autenticación';
      }

      const errorContext = {
        error: (err as Error).message,
        tokenPrefix: token?.slice(0, 10) || 'none',
        ip: req.ip,
      };
      logger.error(errorContext, `🚨 ${message}`);
      return res.status(401).json({ error: message });
    }
  };
}