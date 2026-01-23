// src/services/vigiladorService.ts
import { VigiladorRepository, prisma } from '../repositories/vigiladorRepository';
import type { SubmitRegistroData, VigiladorEstado } from '../types/index';
import type { Prisma } from '.prisma/client';
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer';
import { toArgentinaTime } from '../utils/dateUtils';
import {
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from '../utils/errorHandler';
import logger from '../utils/logger';
import type { VigiladorEstadoExtendido } from '../types/index';
import crypto from 'crypto'; // ← para UUID si no usas librería externa

export class VigiladorService {
  /**
   * Procesa el escaneo de un punto QR.
   * Versión funcional + mejoras: UUID obligatorio, idempotencia, anti-duplicado con ventana temporal
   */
  static async procesarEscaneo(
    data: SubmitRegistroData & { uuid: string } // UUID ahora obligatorio
  ): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo, uuid } = data;

    logger.info({ legajo, punto, uuid }, '📥 Iniciando procesamiento de escaneo');

    // 1. Validaciones tempranas
    if (!Number.isInteger(punto) || punto <= 0) {
      throw new ValidationError('El punto debe ser un entero positivo');
    }

    if (!uuid || typeof uuid !== 'string' || uuid.length < 20) {
      throw new ValidationError('UUID válido requerido para idempotencia y sincronización offline');
    }

    // 2. Buscar o crear vigilador (tu lógica original que funcionaba)
    const vigilador: VigiladorEstado = await VigiladorRepository.findOrCreate(
      legajo,
      nombre.trim(),
      punto
    );

    // 3. Cargar vigilador completo con servicio y puntos
    const vigiladorCompleto = await prisma.vigilador.findUnique({
      where: { legajo },
      include: {
        servicio: {
          include: {
            puntos: {
              include: { punto: true },
              orderBy: { punto: { id: 'asc' } },
            },
          },
        },
      },
    });

    if (!vigiladorCompleto) {
      throw new ValidationError('Vigilador no encontrado');
    }

    // 4. Buscar servicios que incluyen este punto
    const serviciosConPunto = await prisma.servicio.findMany({
      where: {
        puntos: {
          some: { puntoId: punto },
        },
      },
      include: {
        puntos: {
          include: { punto: true },
          orderBy: { punto: { id: 'asc' } },
        },
      },
    });

    let servicioAsignado: typeof vigiladorCompleto.servicio;
    let puntosDelServicio: { id: number; nombre: string }[] = [];

    // 5. Lógica de asignación o validación del servicio (tu flujo original)
    if (vigiladorCompleto.rondaActiva === false && vigiladorCompleto.ultimoPunto === 0) {
      // PRIMER ESCANEO → ASIGNAR SERVICIO AUTOMÁTICAMENTE
      if (serviciosConPunto.length === 0) {
        logger.warn({ legajo, punto }, 'Punto no asignado a ningún servicio');
        throw new ValidationError('Este punto no está asignado a ningún cliente');
      }
      if (serviciosConPunto.length > 1) {
        const nombres = serviciosConPunto.map(s => s.nombre).join(', ');
        logger.warn({ legajo, punto, servicios: nombres }, 'Punto compartido');
        throw new ForbiddenError(`Punto en múltiples servicios: ${nombres}`);
      }

      servicioAsignado = serviciosConPunto[0];
      puntosDelServicio = servicioAsignado.puntos.map(sp => sp.punto);

      // Asignar servicio
      await prisma.vigilador.update({
        where: { legajo },
        data: { servicioId: servicioAsignado.id },
      });

      logger.info(
        { legajo, servicio: servicioAsignado.nombre, punto },
        '✅ Servicio asignado automáticamente'
      );
    } else {
      // Ronda activa → validar servicio actual
      if (!vigiladorCompleto.servicio) {
        throw new ValidationError('Ronda activa sin servicio asignado');
      }
      servicioAsignado = vigiladorCompleto.servicio;
      puntosDelServicio = servicioAsignado.puntos.map(sp => sp.punto);

      const puntoValido = puntosDelServicio.find(p => p.id === punto);
      if (!puntoValido) {
        throw new ValidationError(
          `Punto no pertenece a tu ronda (${servicioAsignado.nombre}).`
        );
      }
    }

    // 6. Validación de secuencia (mejorada: reset implícito para nueva ronda + logging detallado)
    const puntosOrdenados = puntosDelServicio.map(p => ({
      id: p.id,
      nombre: p.nombre,
    }));

    const totalPuntos = puntosOrdenados.length;
    let posicionActual = vigiladorCompleto.ultimoPunto;

    logger.debug({
      legajo,
      rondaActiva: vigiladorCompleto.rondaActiva,
      ultimoPunto: posicionActual,
      totalPuntos,
      puntoSolicitado: punto,
      primerPunto: puntosOrdenados[0]?.id,
      siguienteEsperado: posicionActual > 0 ? puntosOrdenados[posicionActual]?.id : puntosOrdenados[0]?.id,
    }, '🔍 Validando secuencia de ronda');

    let esperadoId: number;
    let mensajeError: string;

    // Caso 1: Ronda no iniciada o intento de reset con punto 1
    if (punto === puntosOrdenados[0].id && posicionActual !== 0) {
      // Reset implícito: Si escanean primer punto pero ronda atascada, resetea y inicia nueva
      await prisma.vigilador.update({
        where: { legajo },
        data: { ultimoPunto: 0, rondaActiva: false },
      });
      logger.info({ legajo, punto }, '🔄 Ronda reseteada implícitamente para inicio nuevo');
      posicionActual = 0; // Actualiza local para proceder
    }

    if (posicionActual === 0) {
      esperadoId = puntosOrdenados[0].id;
      if (punto !== esperadoId) {
        mensajeError = `Debes iniciar la ronda por el punto ${esperadoId} (${puntosOrdenados[0].nombre})`;
        logger.warn({ esperado: esperadoId, recibido: punto }, '⚠️ Intento de inicio inválido');
        throw new ValidationError(mensajeError);
      }
    } else {
      if (posicionActual >= totalPuntos) {
        logger.error({ legajo, ultimoPunto: posicionActual, total: totalPuntos }, 'Estado inconsistente: ultimoPunto >= total puntos');
        throw new ValidationError('Estado de ronda inconsistente - contacta administrador');
      }

      esperadoId = puntosOrdenados[posicionActual].id;
      if (punto !== esperadoId) {
        mensajeError = `Siguiente punto esperado: ${esperadoId} (${puntosOrdenados[posicionActual].nombre}). No puedes escanear ${punto} ahora.`;
        logger.warn({
          esperado: esperadoId,
          nombreEsperado: puntosOrdenados[posicionActual].nombre,
          recibido: punto,
          rondaActiva: vigiladorCompleto.rondaActiva,
        }, '⚠️ Secuencia inválida detectada');
        throw new ValidationError(mensajeError);
      }
    }

    // Secuencia OK
    logger.info({
      legajo,
      puntoRegistrado: punto,
      progresoActual: `${posicionActual + 1}/${totalPuntos}`,
      rondaActiva: vigiladorCompleto.rondaActiva,
    }, '✅ Secuencia validada correctamente');

    // 7. Nueva mejora: anti-duplicado en ronda actual (ventana temporal)
    const tiempoInicioRondaAprox = new Date(vigiladorCompleto.updatedAt);
    tiempoInicioRondaAprox.setHours(tiempoInicioRondaAprox.getHours() - 24);

    const duplicado = await prisma.registro.findFirst({
      where: {
        vigiladorId: vigiladorCompleto.id,
        servicioId: servicioAsignado.id,
        puntoId: punto,
        timestamp: { gte: tiempoInicioRondaAprox },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (duplicado) {
      throw new ValidationError(`Punto ${punto} ya escaneado en esta ronda activa`);
    }

    // 8. Idempotencia con UUID
    const registroExistente = await prisma.registro.findUnique({ where: { uuid } });
    if (registroExistente) {
      logger.debug({ uuid }, 'Registro ya procesado (idempotente)');
      return { success: true, mensaje: 'Registro ya procesado previamente' };
    }

    // 9. Normalización
    const geoNormalizado = normalizeGeo(geo);
    const novedadesNormalizadas = normalizeNovedades(novedades);

    // 10. Transacción (tu versión callback que funcionaba)
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.registro.create({
        data: {
          vigiladorId: vigiladorCompleto.id,
          puntoId: punto,
          servicioId: servicioAsignado.id,
          timestamp: new Date(timestamp),
          geolocalizacion: geoNormalizado ? JSON.stringify(geoNormalizado) : null,
          novedades: novedadesNormalizadas || null,
          uuid, // ← agregado para idempotencia
        },
      });

      const nuevoProgreso = posicionActual + 1;
      if (nuevoProgreso === totalPuntos) {
        await tx.vigilador.update({
          where: { legajo },
          data: { ultimoPunto: 0, rondaActiva: false },
        });
        logger.info({ legajo, servicio: servicioAsignado.nombre }, 'Ronda completada');
      } else {
        await tx.vigilador.update({
          where: { legajo },
          data: { ultimoPunto: nuevoProgreso, rondaActiva: true },
        });
      }
    });

    // 11. Mensaje
    let mensaje: string;
    if (posicionActual + 1 === totalPuntos) {
      mensaje = `¡Ronda completada! (${servicioAsignado.nombre})`;
    } else {
      mensaje = `Punto ${posicionActual + 1}/${totalPuntos} registrado`;
    }

    logger.info(
      { legajo, punto, servicio: servicioAsignado.nombre, progreso: `${posicionActual + 1}/${totalPuntos}` },
      '✅ Escaneo procesado'
    );

    return { success: true, mensaje };
  }

  /**
   * Lista vigiladores por servicio ID, con progreso normalizado.
   * @param servicioId UUID del servicio
   * @returns Array de estados extendidos
   */
  // En vigiladorService.ts (agrega al final de la clase)
static async getVigiladoresPorServicio(servicioNombre: string): Promise<Array<VigiladorEstadoExtendido>> {
  if (!servicioNombre.trim()) {
    logger.warn({ servicioNombre }, '⚠️ Nombre de servicio inválido');
    throw new ValidationError('Nombre de servicio requerido');
  }

  const servicio = await prisma.servicio.findUnique({
    where: { nombre: servicioNombre },
    include: {
      vigiladores: {
        include: {
          servicio: { include: { puntos: true } }, // Para calcular totalPuntos
        },
      },
    },
  });

  if (!servicio) {
    logger.info({ servicioNombre }, '🔍 Servicio no encontrado');
    throw new NotFoundError('Servicio no encontrado');
  }

  const vigiladoresExtendidos = servicio.vigiladores.map((vigilador: typeof servicio.vigiladores[0]) => {
    const totalPuntos = vigilador.servicio.puntos.length;
    const progreso = totalPuntos > 0 ? Math.round((vigilador.ultimoPunto / totalPuntos) * 100) : 0;

    return {
      ...vigilador,
      progreso,
      servicioNombre: vigilador.servicio.nombre,
      ultimoTimestamp: vigilador.updatedAt ? toArgentinaTime(vigilador.updatedAt) : null,
    };
  });

  logger.info({ servicioNombre, count: vigiladoresExtendidos.length }, '✅ Vigiladores por servicio obtenidos');
  return vigiladoresExtendidos;
}

  // Agregamos al export class VigiladorService
  /**
   * Obtiene el estado normalizado de un vigilador.
   * Incluye progreso en ronda (porcentaje), último punto, y detalles de servicio.
   * Logging Pino: contexto detallado para traceability.
   * @param legajo Legajo único del vigilador
   * @returns VigiladorEstado extendido con progreso y servicio info
   * @throws ValidationError si legajo inválido; NotFoundError si no existe
   */
  static async getEstado(legajo: number): Promise<VigiladorEstadoExtendido> {
    if (!Number.isInteger(legajo) || legajo <= 0) {
      logger.warn({ legajo }, '⚠️ Legajo inválido en getEstado');
      throw new ValidationError('Legajo debe ser un entero positivo');
    }

    const vigilador = await VigiladorRepository.findByLegajoWithPuntos(legajo);
    if (!vigilador) {
      logger.info({ legajo }, '🔍 Vigilador no encontrado en getEstado');
      throw new NotFoundError('Vigilador no encontrado');
    }

    const totalPuntos = vigilador.servicio.puntos.length;
    const progreso = totalPuntos > 0 ? Math.round((vigilador.ultimoPunto / totalPuntos) * 100) : 0;

    const estadoNormalizado = {
      ...vigilador,
      progreso,
      servicioNombre: vigilador.servicio.nombre,
      ultimoTimestamp: vigilador.updatedAt ? toArgentinaTime(vigilador.updatedAt) : null, // Normalización timezone
    };

    logger.debug({ legajo, progreso, servicio: vigilador.servicio.nombre }, '✅ Estado calculado exitosamente');

    return estadoNormalizado;
  }

}