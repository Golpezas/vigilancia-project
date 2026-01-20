// src/routes/vigiladorRoutes.ts

import { Router } from 'express';
import { VigiladorController } from '../controllers/vigiladorController'; // ← .js
import { requireAuth } from '../middlewares/authMiddleware';

import { Request, Response, RequestHandler } from 'express'; // Asegúrate de tener esto (ya lo tenés)

import { prisma } from '../repositories/vigiladorRepository';
//import { VigiladorService } from '../services/vigiladorService'; // Si usas el service para submit
import { z } from 'zod';

const router = Router();

router.post('/submit', VigiladorController.submit);
router.get('/estado/:legajo', VigiladorController.getEstado);
router.get('/estado/:legajo', requireAuth(['ADMIN', 'CLIENT']), VigiladorController.getEstado);

// src/routes/vigiladorRoutes.ts
// ... imports existentes (Router, VigiladorController, requireAuth, prisma, z) ...

// Schema Zod para batch - validación runtime estricta y normalización
const BatchSchema = z.object({
  registros: z.array(
    z.object({
      uuid: z.string().uuid(),
      nombre: z.string().min(1).trim(),
      legajo: z.number().int().positive(),
      punto: z.number().int().min(1).max(20),
      novedades: z.string().optional().transform(val => val?.trim() ?? null),
      timestamp: z.string().datetime({ offset: true }).transform(val => new Date(val)),
      geo: z.object({
        lat: z.number().nullable(),
        long: z.number().nullable(),
      }).optional().nullable(),
    })
  ).min(1, 'Debe enviar al menos un registro'),
});

// Endpoint batch idempotente - type-safe y transaccional
router.post('/submit-batch', (async (req: Request, res: Response) => {
  try {
    const { registros } = BatchSchema.parse(req.body);

    const syncedUuids: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const reg of registros) {
        // 1. Idempotencia: skip si uuid ya existe
        const existing = await tx.registro.findUnique({
          where: { uuid: reg.uuid },
        });

        if (existing) {
          syncedUuids.push(reg.uuid);
          continue;
        }

        // 2. Inferir servicioId desde el punto (para rotación: primer escaneo crea en servicio del punto)
        const punto = await tx.punto.findUnique({
          where: { id: reg.punto },
          include: { servicios: { select: { servicioId: true } } }, // Relación many-to-many via ServicioPunto
        });

        if (!punto || punto.servicios.length === 0) {
          throw new Error(`Punto ${reg.punto} no encontrado o sin servicio asignado`);
        }

        const servicioId = punto.servicios[0].servicioId; // Toma el primer servicio (ajusta si multi-servicio por punto)

        // 3. Crear o obtener vigilador (upsert para creación automática si nuevo)
        const vigilador = await tx.vigilador.upsert({
          where: { legajo: reg.legajo },
          update: {}, // No actualiza si existe
          create: {
            nombre: reg.nombre, // Usa el nombre del form
            legajo: reg.legajo,
            ultimoPunto: 0,
            rondaActiva: false,
            servicio: { connect: { id: servicioId } }, // Asigna al servicio inferido del punto
          },
          select: { id: true, servicioId: true },
        });

        // 4. Crear registro con relaciones
        await tx.registro.create({
          data: {
            vigilador: { connect: { id: vigilador.id } },
            punto: { connect: { id: reg.punto } },
            servicio: { connect: { id: servicioId } },
            timestamp: reg.timestamp,
            geolocalizacion: reg.geo ? JSON.stringify(reg.geo) : null,
            novedades: reg.novedades,
            uuid: reg.uuid,
          },
        });

        syncedUuids.push(reg.uuid);
      }
    });

    return res.status(200).json({
      success: true,
      syncedUuids,
      message: `Procesados ${syncedUuids.length} registros (algunos posiblemente duplicados)`,
    });
  } catch (err: any) {
    console.error('[SUBMIT-BATCH ERROR]', {
      message: err.message,
      stack: err.stack,
      body: req.body,
    });

    const status = err instanceof z.ZodError ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Error interno al procesar batch de registros',
    });
  }
}) as RequestHandler);

export default router;