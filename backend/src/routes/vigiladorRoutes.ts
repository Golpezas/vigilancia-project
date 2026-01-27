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

        const servicioId = String(punto.servicios[0].servicioId); // Asume uno (ajusta si multi-servicio)

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
          throw new Error(`Inconsistencia en orden: Debes escanear el punto ${puntoEsperadoId}.`);
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

        // 6. Actualizar vigilador: avanza ultimoPunto y cierra ronda si es el último punto
        const nuevoUltimoPunto = reg.punto;
        const rondaCompletada = nuevoUltimoPunto === puntosOrdenados[puntosOrdenados.length - 1]; // último en la secuencia

        await tx.vigilador.update({
          where: { id: vigilador.id },
          data: {
            ultimoPunto: rondaCompletada ? 0 : nuevoUltimoPunto,
            rondaActiva: !rondaCompletada,
          },
        });

        if (rondaCompletada) {
          console.log(`Ronda completada para vigilador ${reg.legajo} - punto ${reg.punto}`);
        }

        syncedUuids.push(reg.uuid);
      }
    });

    // ────────────────────────────────────────────────────────────────
    // Preparar respuesta detallada por registro
    // ────────────────────────────────────────────────────────────────

    const results: Array<{
      uuid: string;
      success: boolean;
      mensaje: string;
    }> = [];

    for (const reg of registros) {
      const uuid = reg.uuid;

      // Buscar si ya existe (idempotencia)
      const existingRegistro = await prisma.registro.findUnique({
        where: { uuid },
        include: {
          punto: true,
          servicio: true,
          vigilador: true,
        },
      });

      let puntoActual: number;
      let servicioId: number;

      if (existingRegistro) {
        // Caso ya existía → usamos datos del registro existente
        puntoActual = existingRegistro.puntoId;
        servicioId = typeof existingRegistro.servicioId === 'string' ? parseInt(existingRegistro.servicioId, 10) : existingRegistro.servicioId;
      } else {
        // Caso nuevo → usamos datos del request (ya validados)
        puntoActual = reg.punto;
        // Necesitamos obtener servicioId → consulta mínima
        const puntoInfo = await prisma.punto.findUnique({
          where: { id: puntoActual },
          include: { servicios: true },
        });

        if (!puntoInfo || puntoInfo.servicios.length === 0) {
          results.push({
            uuid,
            success: false,
            mensaje: `Error: punto ${puntoActual} sin servicio asignado`,
          });
          continue;
        }

        servicioId = typeof puntoInfo.servicios[0].servicioId === 'string' ? parseInt(puntoInfo.servicios[0].servicioId, 10) : puntoInfo.servicios[0].servicioId;
      }

      // ── Reconstrucción común del mensaje rico ──
      const secuencia = await prisma.servicioPunto.findMany({
        where: { servicioId: String(servicioId) },
        orderBy: { punto: { id: 'asc' } },
        select: { puntoId: true },
      });

      if (secuencia.length === 0) {
        results.push({
          uuid,
          success: true, // aún consideramos éxito si ya existía
          mensaje: `Punto ${puntoActual} procesado, pero servicio sin secuencia definida.`,
        });
        continue;
      }

      const puntosOrdenados = secuencia.map(sp => sp.puntoId);
      const indiceActual = puntosOrdenados.indexOf(puntoActual);

      let mensaje = existingRegistro
        ? `Punto ${puntoActual} ya fue registrado previamente.`
        : `Punto ${puntoActual} registrado correctamente.`;

      if (indiceActual === puntosOrdenados.length - 1) {
        mensaje = `¡Ronda completada al 100%! 🎉 Punto ${puntoActual} fue el último${
          existingRegistro ? ' (ya registrado)' : ''
        }.\nPuedes iniciar una nueva ronda escaneando el punto ${puntosOrdenados[0] || 1}.`;
      } else if (indiceActual !== -1) {
        const siguienteId = puntosOrdenados[indiceActual + 1];
        if (siguienteId) {
          mensaje += ` Siguiente esperado: punto ${siguienteId}.`;
        }
      }

      results.push({
        uuid,
        success: true,
        mensaje,
      });
    }

    // ────────────────────────────────────────────────────────────────
    // Respuesta final mejorada
    // ────────────────────────────────────────────────────────────────

    const total = registros.length;
    const synced = syncedUuids.length;

    const summary =
      synced === total
        ? total === 1
          ? 'Registro procesado correctamente'
          : `Todos los ${total} puntos procesados correctamente`
        : synced > 0
          ? `${synced} de ${total} registros sincronizados`
          : 'Ningún registro procesado (verifica duplicados o secuencia)';

    // Para single submit (lo más común), devolvemos el mensaje del primer result
    const mainMessage = total === 1 && results.length > 0 ? results[0].mensaje : null;

    return res.status(200).json({
      success: synced > 0,
      syncedUuids,
      results,           // ← nuevo campo: detalle por registro
      summary,           // ← más claro que el message anterior
      message: mainMessage || summary,  // compatibilidad con frontend actual
    });

  } catch (err: unknown) {
    console.error('[SUBMIT-BATCH ERROR]', {
      message: (err as Error).message,
      stack: (err as Error).stack,
      body: req.body,
    });

    let status = 500;
    let errorMsg = 'Error interno al procesar batch de registros';

    // Handle Zod validation errors
    if (err instanceof z.ZodError) {
      status = 400;
      errorMsg = `Error de validación: ${err.errors[0].message}`;
    } else if (err instanceof Error && err.message) {
      // Handle custom application errors (validation, not found, etc.)
      status = 400;
      errorMsg = err.message; // e.g., 'Inconsistencia en orden: Debes escanear el punto 3...'
    }

    return res.status(status).json({
      success: false,
      error: errorMsg,
    });
  }
}) as RequestHandler);

export default router;