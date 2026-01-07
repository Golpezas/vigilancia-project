// src/routes/adminRoutes.ts
// Rutas administrativas - Multi-servicio robusto 2026
// Protección con API key, validación Zod estricta, logging estructurado

import { Router } from 'express';
import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { ValidationError } from '../utils/errorHandler';

const router = Router();

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-key-change-in-prod';

const requireAdmin = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== ADMIN_API_KEY) {
    logger.warn({ ip: req.ip, path: req.path }, '⚠️ Acceso admin denegado - key inválida');
    return res.status(401).json({ error: 'Acceso denegado' });
  }
  next();
};

// Schema para asignar servicio
const AsignarServicioSchema = z.object({
  legajo: z.number().int().positive(),
  servicioNombre: z.string().min(3),
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
      '🔄 Servicio asignado a vigilador'
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
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === 'P2025') { // Prisma: registro no encontrado
      return res.status(404).json({ error: 'Vigilador no encontrado' });
    }
    logger.error({ err, body: req.body }, '🚨 Error asignando servicio');
    res.status(500).json({ error: 'Error interno' });
  }
});

// Listar vigiladores con su servicio (útil para panel admin)
router.get('/vigiladores', requireAdmin, async (req, res) => {
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
});

export default router;