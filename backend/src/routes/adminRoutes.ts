// src/routes/adminRoutes.ts
// Rutas administrativas protegidas con JWT + rol ADMIN
// Mejores prácticas 2026: Tipado estricto, transacciones atómicas, logging estructurado, validación Zod runtime
// Normalización: Trim en nombres, validación UUID en IDs futuros
// Seguridad: Role-based access, manejo idempotente con upsert

import { Router, Request, Response } from 'express';
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
router.post('/servicio', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { nombre, puntoIds } = CreateServicioSchema.parse(req.body);

    // Transacción atómica con tipado correcto (resuelve TS2769 y TS2339)
    const servicio = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nuevoServicio = await tx.servicio.upsert({
        where: { nombre: nombre.trim() }, // Normalización: trim para evitar duplicados sucios
        update: {},
        create: { nombre: nombre.trim() },
      });

      for (const puntoId of puntoIds) {
        await tx.servicioPunto.upsert({
          where: { servicioId_puntoId: { servicioId: nuevoServicio.id, puntoId } },
          update: {},
          create: { servicioId: nuevoServicio.id, puntoId },
        });
      }

      return nuevoServicio;
    });

    logger.info(
      { admin: req.user?.email, servicioId: servicio.id, nombre: servicio.nombre, puntos: puntoIds.length },
      'Servicio creado/actualizado exitosamente'
    );

    res.json({
      success: true,
      servicio: { id: servicio.id, nombre: servicio.nombre },
    } as ApiResponse<any>);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: err.errors,
      } as ApiResponse);
    }

    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'Servicio duplicado' } as ApiResponse);
      if (err.code === 'P2025') return res.status(404).json({ error: 'Punto no encontrado' } as ApiResponse);
    }

    logger.error({ err, body: req.body, admin: req.user?.email }, 'Error creando servicio');
    res.status(500).json({ error: 'Error interno del servidor' } as ApiResponse);
  }
});

export default router;