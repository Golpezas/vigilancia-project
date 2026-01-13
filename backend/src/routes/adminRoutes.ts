// src/routes/adminRoutes.ts
// Rutas administrativas protegidas con JWT + rol ADMIN (2026 best practices)

import { Router, Request, Response } from 'express';
import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorHandler';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
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

router.post('/vigilador/asignar-servicio', requireAdmin, async (req, res) => {
  try {
    const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);

    const servicio = await prisma.servicio.findUnique({
      where: { nombre: servicioNombre },
    });

    if (!servicio) throw new ValidationError(`Servicio "${servicioNombre}" no existe`);

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
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }

    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Vigilador o servicio no encontrado' });
    }

    logger.error({ err, body: req.body, admin: req.user?.email }, 'Error crítico en asignación de servicio');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Listado de vigiladores ────────────────────────────────────────────────────
router.get('/vigiladores', requireAdmin, async (req, res) => {
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
    });
  } catch (err: unknown) {
    logger.error({ err, admin: req.user?.email }, 'Error listando vigiladores');
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Crear/actualizar servicio con puntos ──────────────────────────────────────
const CreateServicioSchema = z.object({
  nombre: z.string().min(3).max(100),
  puntoIds: z.array(z.number().int().positive()).min(1, 'Debe seleccionar al menos un punto'),
});

router.post('/servicio', requireAdmin, async (req, res) => {
  try {
    const { nombre, puntoIds } = CreateServicioSchema.parse(req.body);

    const servicio = await prisma.$transaction(async (tx: typeof prisma) => {
      const nuevoServicio = await tx.servicio.upsert({
        where: { nombre: nombre.trim() },
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
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: err.errors,
      });
    }

    logger.error({ err, body: req.body, admin: req.user?.email }, 'Error creando servicio');
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;