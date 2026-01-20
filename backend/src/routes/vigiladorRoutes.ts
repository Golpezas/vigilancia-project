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

        // 2. Inferir servicioId desde el punto (normalización: asegura relación Punto → Servicio)
        const punto = await tx.punto.findUnique({
          where: { id: reg.punto },
          include: { servicios: { select: { servicioId: true } } }, // Many-to-many via ServicioPunto
        });

        if (!punto || punto.servicios.length === 0) {
          throw new Error(`Punto ${reg.punto} no encontrado o sin servicio asignado`);
        }

        const servicioId = punto.servicios[0].servicioId; // Toma el primer servicio (ajusta si multi)

        // 3. Crear o obtener vigilador (upsert con creación automática si nuevo)
        const vigilador = await tx.vigilador.upsert({
          where: { legajo: reg.legajo },
          update: {}, // No actualiza si existe (podemos agregar lógica de rotación aquí si cambian servicios)
          create: {
            nombre: reg.nombre,
            legajo: reg.legajo,
            ultimoPunto: reg.punto, // Inicializa con el primer punto escaneado
            rondaActiva: true,      // Inicia ronda activa al crear (resuelve problema 1)
            servicio: { connect: { id: servicioId } }, // Asigna al servicio del punto
          },
          select: { id: true, servicioId: true, ultimoPunto: true, rondaActiva: true },
        });

        // 4. Validación de orden secuencial (no saltos - resuelve problema 2)
        const puntoEsperado = vigilador.ultimoPunto + 1; // Siguiente esperado
        if (reg.punto !== puntoEsperado) {
          throw new Error(`Inconsistencia en orden: Debes escanear el punto ${puntoEsperado} antes de ${reg.punto}. Inicia la ronda si es necesario.`);
        }

        // 5. Crear registro (normalizado)
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

        // 6. Actualizar vigilador: avanza ultimoPunto y mantiene rondaActiva true (hasta fin de ronda)
        await tx.vigilador.update({
          where: { id: vigilador.id },
          data: {
            ultimoPunto: reg.punto,
            rondaActiva: true, // Mantiene activa hasta completar todos los puntos (lógica futura para false)
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