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
          syncedUuids.push(reg.uuid); // Ya estaba, lo consideramos "sincronizado"
          continue;
        }

        // 2. Buscar vigilador para obtener IDs y servicioId
        const vigilador = await tx.vigilador.findUnique({
          where: { legajo: reg.legajo },
          select: { id: true, servicioId: true },
        });

        if (!vigilador) {
          throw new Error(`Vigilador con legajo ${reg.legajo} no encontrado`);
        }

        // 3. Crear registro usando relaciones connect (checked mode)
        await tx.registro.create({
          data: {
            vigilador: { connect: { id: vigilador.id } },
            punto: { connect: { id: reg.punto } },
            servicio: { connect: { id: vigilador.servicioId } }, // ← connect a servicio usando ID del vigilador
            timestamp: reg.timestamp, // ya transformado a Date
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