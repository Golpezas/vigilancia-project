// src/routes/adminRoutes.ts
// Rutas administrativas para gestión multi-servicio
// Mejores prácticas 2026: Validación Zod, protección API key, upsert idempotente, logging estructurado

import { Router } from 'express';
import { prisma } from '../repositories/vigiladorRepository'; // Singleton Prisma
import { z } from 'zod';
import logger from '../utils/logger';

const router = Router();

// Configuración seguridad simple (extensible a JWT/OAuth)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-key-change-in-prod'; // ← Agregar a .env

// Middleware protección admin
const requireAdmin = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey !== ADMIN_API_KEY) {
    logger.warn({ ip: req.ip, path: req.path }, '⚠️ Intento acceso admin sin key válida');
    return res.status(401).json({ error: 'Acceso denegado: clave admin inválida' });
  }
  next();
};

// Schema Zod para creación de servicio
const CreateServicioSchema = z.object({
  nombre: z.string().min(3, 'Nombre muy corto').max(100),
  puntoIds: z.array(z.number().int().positive()).min(1, 'Debe asignar al menos 1 punto'),
});

router.post('/servicio', requireAdmin, async (req, res) => {
  try {
    const body = CreateServicioSchema.parse(req.body); // Validación runtime

    const servicio = await prisma.servicio.create({
      data: {
        nombre: body.nombre.trim(),
      },
    });

    // Asignar puntos (upsert idempotente)
    for (const puntoId of body.puntoIds) {
      await prisma.servicioPunto.upsert({
        where: {
          servicioId_puntoId: {
            servicioId: servicio.id,
            puntoId,
          },
        },
        update: {},
        create: {
          servicioId: servicio.id,
          puntoId,
        },
      });
    }

    logger.info({ servicioId: servicio.id, nombre: servicio.nombre, puntosAsignados: body.puntoIds.length }, '✅ Nuevo servicio creado por admin');

    res.json({
      success: true,
      servicio: {
        id: servicio.id,
        nombre: servicio.nombre,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: err.errors });
    }
    logger.error({ err, body: req.body }, '🚨 Error creando servicio');
    res.status(500).json({ error: 'Error interno' });
  }
});

// Lista todos los servicios con sus puntos (útil para admin)
router.get('/servicios', requireAdmin, async (req, res) => {
  const servicios = await prisma.servicio.findMany({
    include: {
      puntos: {
        include: { punto: true },
        orderBy: { punto: { id: 'asc' } },
      },
    },
  });

  res.json({ servicios });
});

export default router;