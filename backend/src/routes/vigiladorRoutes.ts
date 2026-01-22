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

        // 2. Relevamiento de información: obtener secuencia de puntos del servicio ordenada (best practice: cacheable en prod)
        const punto = await tx.punto.findUnique({
          where: { id: reg.punto },
          include: { servicios: true }, // Relación many-to-many
        });

        if (!punto || punto.servicios.length === 0) {
          throw new Error(`Punto ${reg.punto} no encontrado o sin servicio asignado`);
        }

        const servicioId = punto.servicios[0].servicioId; // Asume uno (ajusta si multi-servicio)

        const secuenciaPuntos = await tx.servicioPunto.findMany({
          where: { servicioId },
          orderBy: { punto: { id: 'asc' } }, // Normalización: orden por ID ascendente (secuencial)
          select: { puntoId: true },
        });

        if (secuenciaPuntos.length === 0) {
          throw new Error(`Servicio ${servicioId} sin puntos asignados`);
        }

        const puntosOrdenados = secuenciaPuntos.map(sp => sp.puntoId); // [4,5,6] para Cliente Sur

        // 3. Crear/obtener vigilador (upsert con creación automática)
        const vigilador = await tx.vigilador.upsert({
          where: { legajo: reg.legajo },
          update: {},
          create: {
            nombre: reg.nombre,
            legajo: reg.legajo,
            ultimoPunto: 0, // Inicializa en 0 para nuevo
            rondaActiva: false, // Inicial false, se activa al registrar primer punto
            servicio: { connect: { id: servicioId } },
          },
          select: { id: true, servicioId: true, ultimoPunto: true, rondaActiva: true },
        });

        // 4. Validación de orden secuencial por servicio (no saltos)
        const indiceActual = puntosOrdenados.indexOf(reg.punto);
        if (indiceActual === -1) {
          throw new Error(`Punto ${reg.punto} no pertenece al servicio ${servicioId}`);
        }

        let indiceEsperado = vigilador.ultimoPunto === 0 ? 0 : indiceActual; // Para inicio (ultimoPunto=0), espera el primer punto del servicio (indice 0)

        if (vigilador.ultimoPunto !== 0) {
          indiceEsperado = puntosOrdenados.indexOf(vigilador.ultimoPunto) + 1;
          if (indiceEsperado >= puntosOrdenados.length) {
            throw new Error('Ronda completada. Inicia una nueva ronda.');
          }
        }

        if (indiceActual !== indiceEsperado) {
          const puntoEsperadoId = puntosOrdenados[indiceEsperado];
          throw new Error(`Inconsistencia en orden: Debes escanear el punto ${puntoEsperadoId} antes de ${reg.punto}. Inicia la ronda si es necesario.`);
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

        // 6. Actualizar vigilador: avanza ultimoPunto y setea rondaActiva true
        await tx.vigilador.update({
          where: { id: vigilador.id },
          data: {
            ultimoPunto: reg.punto,
            rondaActiva: true, // Activa/mantiene al registrar punto
          },
        });

        syncedUuids.push(reg.uuid);
      }
    });

    const total = registros.length;
    const synced = syncedUuids.length;

    let message = '';
    if (synced === total) {
      // Todo salió perfecto
      if (total === 1) {
        message = 'Punto procesado y registrado correctamente';
      } else {
        message = `Todos los ${total} puntos procesados correctamente`;
      }
    } else if (synced > 0) {
      // Algunos OK, otros duplicados o fallidos
      message = `${synced} de ${total} registros sincronizados. Algunos ya estaban procesados (duplicados)`;
    } else {
      // Nada se sincronizó
      message = 'Ningún registro se sincronizó (posible duplicado o error de validación)';
    }

    return res.status(200).json({
      success: synced > 0,
      syncedUuids,
      message,
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