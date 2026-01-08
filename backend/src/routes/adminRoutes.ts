// src/routes/adminRoutes.ts
// Rutas administrativas - Multi-servicio robusto 2026
// Protección con API key, validación Zod estricta, logging estructurado Pino

import { Router } from 'express';
import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorHandler';
import { Prisma } from '@prisma/client'; // ← IMPORT CLAVE

const router = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-key-change-in-prod';

const requireAdmin = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-admin-key'] as string | undefined;
  if (apiKey !== ADMIN_API_KEY) {
    logger.warn({ ip: req.ip, path: req.path, providedKey: apiKey ? 'presente' : 'ausente' }, '⚠️ Acceso admin denegado');
    return res.status(401).json({ error: 'Acceso denegado: clave API inválida' });
  }
  next();
};

// Schema para asignar servicio
const AsignarServicioSchema = z.object({
  legajo: z.number().int().positive('Legajo debe ser positivo'),
  servicioNombre: z.string().min(3, 'Nombre del servicio muy corto'),
});

router.post('/vigilador/asignar-servicio', requireAdmin, async (req, res) => {
  try {
    const { legajo, servicioNombre } = AsignarServicioSchema.parse(req.body);

    const servicio = await prisma.servicio.findUnique({
      where: { nombre: servicioNombre },
    });

    if (!servicio) {
      throw new ValidationError(`Servicio "${servicioNombre}" no existe`);
    }

    const vigilador = await prisma.vigilador.update({
      where: { legajo },
      data: {
        servicioId: servicio.id,
        ultimoPunto: 0,
        rondaActiva: false, // Reinicia ronda al cambiar servicio
      },
      include: { servicio: true },
    });

    logger.info(
      { legajo, nuevoServicio: servicio.nombre, vigiladorId: vigilador.id },
      '✅ Servicio asignado manualmente a vigilador'
    );

    res.json({
      success: true,
      mensaje: `Servicio "${servicio.nombre}" asignado al legajo ${legajo}`,
      vigilador: {
        legajo: vigilador.legajo,
        nombre: vigilador.nombre,
        servicio: vigilador.servicio.nombre,
      },
    });
  } catch (err: unknown) {
    // 1. Errores de validación Zod
    if (err instanceof z.ZodError) {
      logger.warn({ body: req.body, errors: err.errors }, 'Datos inválidos en asignación de servicio');
      return res.status(400).json({
        error: 'Datos inválidos',
        details: err.errors.map(e => ({
          campo: e.path.join('.'),
          mensaje: e.message,
        })),
      });
    }

    // 2. Nuestros errores personalizados
    if (err instanceof ValidationError) {
      logger.warn({ body: req.body, message: err.message }, 'Validación fallida');
      return res.status(400).json({ error: err.message });
    }

    // 3. Errores conocidos de Prisma (P2025 = registro no encontrado en update)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        logger.warn({ legajo: req.body.legajo }, 'Vigilador no encontrado al asignar servicio');
        return res.status(404).json({ error: 'Vigilador no encontrado' });
      }
    }

    // 4. Error inesperado
    const message = err instanceof Error ? err.message : 'Error desconocido';
    const stack = err instanceof Error ? err.stack : undefined;

    logger.error(
      { err, message, stack, body: req.body },
      '🚨 Error inesperado en asignación de servicio'
    );

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Listar vigiladores con su servicio (útil para panel admin)
router.get('/vigiladores', requireAdmin, async (req, res) => {
  try {
    const vigiladores = await prisma.vigilador.findMany({
      select: {
        id: true,
        nombre: true,
        legajo: true,
        ultimoPunto: true,
        rondaActiva: true,
        servicio: { select: { nombre: true } },
      },
      orderBy: { legajo: 'asc' },
    });

    res.json({ vigiladores });
  } catch (err: unknown) {
    logger.error({ err }, 'Error listando vigiladores');
    res.status(500).json({ error: 'Error interno' });
  }
});

// Schema para crear servicio (normalizado de versiones iniciales)
const CreateServicioSchema = z.object({
  nombre: z.string().min(3, 'Nombre muy corto').max(100),
  puntoIds: z.array(z.number().int().positive()).min(1, 'Al menos un punto'),
});

router.post('/servicio', requireAdmin, async (req, res) => {
  try {
    const { nombre, puntoIds } = CreateServicioSchema.parse(req.body);

    // Transacción para atomicidad (crear servicio + asignar puntos)
    const servicio = await prisma.$transaction(async (tx) => {
      const nuevoServicio = await tx.servicio.upsert({
        where: { nombre },
        update: {},
        create: { nombre: nombre.trim() },
      });

      for (const puntoId of puntoIds) {
        await tx.servicioPunto.upsert({
          where: {
            servicioId_puntoId: {
              servicioId: nuevoServicio.id,
              puntoId,
            },
          },
          update: {},
          create: {
            servicioId: nuevoServicio.id,
            puntoId,
          },
        });
      }

      return nuevoServicio;
    });

    logger.info({ servicioId: servicio.id, nombre: servicio.nombre, puntos: puntoIds.length }, '✅ Servicio creado/actualizado');

    res.json({
      success: true,
      servicio: {
        id: servicio.id,
        nombre: servicio.nombre,
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      logger.warn({ body: req.body, errors: err.errors }, 'Datos inválidos en creación de servicio');
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }

    const message = err instanceof Error ? err.message : 'Error desconocido';
    logger.error({ err, message, body: req.body }, '🚨 Error creando servicio');
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;