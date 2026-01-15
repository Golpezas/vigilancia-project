// src/routes/adminRoutes.ts
// Rutas administrativas protegidas con JWT + rol ADMIN
// Mejores prácticas 2026: Tipado estricto, transacciones atómicas, logging estructurado, validación Zod runtime
// Normalización: Trim en nombres, validación UUID en IDs futuros
// Seguridad: Role-based access, manejo idempotente con upsert

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorHandler';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'; // Para errores específicos
import type { Prisma } from '@prisma/client'; // ← Import clave para TransactionClient (resuelve TS2305)
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

interface AuthenticatedUser {
  email?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

interface VigiladorResponse {
  legajo: number;
  servicio: string;
}

interface ApiResponse<T = unknown> {
  success?: boolean;
  mensaje?: string;
  error?: string;
  details?: unknown;
  vigilador?: T;
  vigiladores?: T[];
  total?: number;
  requestedBy?: string;
  servicio?: T;
}

// Protección: solo usuarios con rol ADMIN
const requireAdmin = requireAuth(['ADMIN']);

// ── Asignar servicio a vigilador ──────────────────────────────────────────────
const AsignarServicioSchema = z.object({
  legajo: z.number().int().positive('Legajo debe ser positivo'),
  servicioNombre: z.string().min(3, 'Nombre del servicio muy corto').max(100),
});

/**
 * Asigna un servicio a un vigilador por legajo.
 * @route POST /vigilador/asignar-servicio
 * @access Admin only
 */
router.post('/vigilador/asignar-servicio', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);

    const servicio = await prisma.servicio.findUnique({
      where: { nombre: servicioNombre.trim() }, // Normalización: trim para consistencia
    });

    if (!servicio) {
      throw new ValidationError(`Servicio "${servicioNombre}" no existe`);
    }

    const vigilador = await prisma.vigilador.update({
      where: { legajo },
      data: {
        servicioId: servicio.id,
        ultimoPunto: 0,
        rondaActiva: false,
      },
      include: { servicio: { select: { nombre: true } } },
    });

    logger.info(
      {
        adminEmail: req.user?.email,
        legajo,
        servicio: servicio.nombre,
      },
      'Servicio asignado por administrador'
    );

    res.json({
      success: true,
      mensaje: `Servicio ${servicio.nombre} asignado al legajo ${legajo}`,
      vigilador: {
        legajo: vigilador.legajo,
        servicio: vigilador.servicio.nombre,
      },
    } as ApiResponse<VigiladorResponse>);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      } as ApiResponse);
    }

    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message } as ApiResponse);
    }

    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Vigilador o servicio no encontrado' } as ApiResponse);
    }

    logger.error({ err, body: req.body, admin: req.user?.email }, 'Error crítico en asignación de servicio');
    res.status(500).json({ error: 'Error interno del servidor' } as ApiResponse);
  }
});

// ── Listado de vigiladores ────────────────────────────────────────────────────
/**
 * Lista todos los vigiladores con info básica.
 * @route GET /vigiladores
 * @access Admin only
 */
router.get('/vigiladores', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const vigiladores = await prisma.vigilador.findMany({
      select: {
        id: true,
        legajo: true,
        nombre: true,
        ultimoPunto: true,
        rondaActiva: true,
        servicio: { select: { nombre: true } },
      },
      orderBy: { legajo: 'asc' },
    });

    res.json({
      success: true,
      vigiladores,
      total: vigiladores.length,
      requestedBy: req.user?.email,
    } as ApiResponse<any>);
  } catch (err: unknown) {
    logger.error({ err, admin: req.user?.email }, 'Error listando vigiladores');
    res.status(500).json({ error: 'Error interno' } as ApiResponse);
  }
});

// ── Crear/actualizar servicio con puntos ──────────────────────────────────────
const CreateServicioSchema = z.object({
  nombre: z.string().min(3).max(100),
  puntoIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto'),
});

/**
 * Crea o actualiza un servicio con puntos asignados (idempotente).
 * @route POST /servicio
 * @access Admin only
 */
router.post('/crear-servicio', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = CreateServicioSchema.parse(req.body);
    logger.info({ admin: req.user?.email, nombre: parsed.nombre, puntos: parsed.puntoIds.length }, '📥 Intentando crear servicio');

    // Transacción atómica con tipado correcto (resuelve TS2769 y TS2339)
    const servicio = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nuevoServicio = await tx.servicio.upsert({
        where: { nombre: parsed.nombre.trim() }, // Normalización: trim para evitar duplicados sucios
        update: {},
        create: { nombre: parsed.nombre.trim() },
      });

      for (const puntoId of parsed.puntoIds) {
        await tx.servicioPunto.upsert({
          where: { servicioId_puntoId: { servicioId: nuevoServicio.id, puntoId } },
          update: {},
          create: { servicioId: nuevoServicio.id, puntoId },
        });
      }

      return nuevoServicio;
    });

    logger.info({ admin: req.user?.email, servicioId: servicio.id }, '✅ Servicio creado');
    res.json({ success: true, servicio: { id: servicio.id, nombre: servicio.nombre } });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      logger.warn({ issues: err.issues, admin: req.user?.email }, '⚠️ Datos inválidos en crear-servicio');
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    } else if (err instanceof PrismaClientKnownRequestError) {
      logger.error({ code: err.code, meta: err.meta, admin: req.user?.email }, '🚨 Error Prisma en crear-servicio');
      return res.status(409).json({ error: 'Conflicto en DB (e.g., nombre duplicado)' });
    }
    logger.error({ err, admin: req.user?.email }, '❌ Error inesperado en crear-servicio');
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Listar todos los puntos disponibles ───────────────────────────────────────
/**
 * Devuelve la lista completa de puntos disponibles para selección en creación de servicio.
 * @route GET /puntos
 * @access Admin only
 */
router.get('/puntos', requireAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Query eficiente: solo campos necesarios (normalización data)
    const puntos = await prisma.punto.findMany({
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { id: 'asc' }, // Secuencia predecible
    });

    // Validación output con Zod (evita enviar data corrupta)
    const outputSchema = z.array(
      z.object({
        id: z.number().int().positive(),
        nombre: z.string().min(1),
      })
    );

    const parsed = outputSchema.safeParse(puntos);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues, admin: req.user?.email }, '⚠️ Datos de puntos inválidos en DB');
      throw new ValidationError('Datos de puntos inconsistentes');
    }

    // Logging estructurado con traceability (quién pidió, cuántos resultados)
    logger.info(
      {
        adminEmail: req.user?.email,
        count: parsed.data.length,
        path: req.path,
      },
      '✅ Lista de puntos devuelta exitosamente'
    );

    res.json(parsed.data);
  } catch (err: unknown) {
    next(err); // Delega a handler global
  }
});

export default router;