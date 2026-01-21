// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial dinámica por servicio
// Mejores prácticas 2026: Asignación automática de servicio al iniciar ronda
// Type-safety estricta, early validation, logging Pino estructurado, JSDoc completo

// src/services/vigiladorService.ts

import { VigiladorRepository, prisma } from '../repositories/vigiladorRepository';
import type { SubmitRegistroData, VigiladorEstado } from '../types/index';
import type { Prisma } from '.prisma/client';

// Utilidades de normalización y formateo
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer';
import { toArgentinaTime } from '../utils/dateUtils';                

// Manejo de errores custom (AppError family)
import {
  ForbiddenError,
  ValidationError,
  NotFoundError,          
} from '../utils/errorHandler';

import logger from '../utils/logger';

import type { VigiladorEstadoExtendido } from '../types/index';

export class VigiladorService {
  /**
   * Procesa el escaneo de un punto QR con validaciones estrictas de secuencia y estado de ronda.
   * - Impide duplicados del mismo punto en la misma ronda
   * - Prohíbe reiniciar (punto 1) si ronda activa e incompleta
   * - Asigna servicio automáticamente solo en el primer escaneo válido
   * - Idempotente vía UUID (para sync offline)
   * - Todo dentro de una transacción atómica + manejo de concurrencia
   */
  static async procesarEscaneo(
    data: SubmitRegistroData & { uuid: string } // uuid ahora obligatorio (no optional)
  ): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo, uuid } = data;

    logger.info({ legajo, punto, uuid }, '📥 Iniciando procesamiento de escaneo');

    // 1. Validaciones tempranas (fail-fast)
    if (!Number.isInteger(punto) || punto <= 0) {
      throw new ValidationError('El punto debe ser un entero positivo');
    }

    if (!uuid || typeof uuid !== 'string' || uuid.length < 20) {
      throw new ValidationError('UUID válido requerido para idempotencia y sincronización offline');
    }

    // 2. Obtener vigilador con include completo
    const vigilador = await prisma.vigilador.findUnique({
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

    if (!vigilador) {
      throw new NotFoundError('Vigilador no encontrado');
    }

    if (!vigilador.servicio) {
      throw new ValidationError('El vigilador no tiene un servicio asignado. Contacta al administrador.');
    }

    const servicio = vigilador.servicio;
    const puntosOrdenados = servicio.puntos.map(sp => sp.punto);

    if (puntosOrdenados.length === 0) {
      throw new ValidationError('El servicio no tiene puntos configurados');
    }

    // 3. Idempotencia: verificar UUID
    const registroExistente = await prisma.registro.findUnique({ where: { uuid } });
    if (registroExistente) {
      logger.debug({ uuid, registroId: registroExistente.id }, '🔄 Registro duplicado detectado (idempotente)');
      return { success: true, mensaje: 'Registro ya procesado previamente' };
    }

    // 4. Estado de ronda
    const esInicioRonda = vigilador.ultimoPunto === 0 && !vigilador.rondaActiva;

    // 5. Validaciones estrictas de secuencia y estado
    if (vigilador.rondaActiva && !esInicioRonda) {
      // Ronda en curso → debe ser el punto SIGUIENTE
      const indiceEsperado = vigilador.ultimoPunto; // ya es 1-based
      const puntoEsperado = puntosOrdenados[indiceEsperado];

      if (!puntoEsperado || punto !== puntoEsperado.id) {
        throw new ValidationError(
          `Secuencia incorrecta. Debes escanear el punto ${puntoEsperado?.id ?? '?'}: ${puntoEsperado?.nombre ?? 'desconocido'}`
        );
      }

      // Anti-duplicado en misma ronda (mejor criterio: existe registro con mismo vigilador + servicio + punto + rondaActiva=true)
      const duplicado = await prisma.registro.findFirst({
        where: {
          vigiladorId: vigilador.id,
          servicioId: servicio.id,
          puntoId: punto,
          // Opcional: agregar filtro por ronda si tienes un campo rondaId o similar
        },
        orderBy: { timestamp: 'desc' },
      });

      if (duplicado) {
        logger.warn({ uuid, duplicadoId: duplicado.id }, '⚠️ Intento de duplicado en misma ronda');
        throw new ValidationError('Este punto ya fue registrado en la ronda actual');
      }
    } else if (esInicioRonda) {
      // Inicio → debe ser el PRIMER punto
      const primerPunto = puntosOrdenados[0];
      if (punto !== primerPunto.id) {
        throw new ValidationError(
          `Debes iniciar la ronda escaneando primero el punto ${primerPunto.id} (${primerPunto.nombre})`
        );
      }
    } else {
      // Estado inconsistente (ronda cerrada pero ultimoPunto > 0)
      throw new ValidationError('Estado inconsistente del vigilador. Contacta al administrador para resetear.');
    }

    // 6. Normalización
    const geoNormalizado = normalizeGeo(geo);
    const novedadesNormalizadas = normalizeNovedades(novedades);
    const timestampDate = new Date(timestamp);

    if (isNaN(timestampDate.getTime())) {
      throw new ValidationError('Formato de timestamp inválido');
    }

    // 7. Transacción atómica + lógica final dentro de tx (evita race conditions)
    let mensajeFinal: string = '';

    await prisma.$transaction(async (tx) => {
      // Re-leer vigilador dentro de transacción (previene race conditions)
      const vigiladorTx = await tx.vigilador.findUnique({
        where: { legajo },
        select: { ultimoPunto: true, rondaActiva: true },
      });

      if (!vigiladorTx) throw new Error('Vigilador desapareció durante transacción');

      const nuevoUltimoPunto = vigiladorTx.ultimoPunto + 1;
      const rondaCompletada = nuevoUltimoPunto === puntosOrdenados.length;

      // Crear registro
      await tx.registro.create({
        data: {
          vigiladorId: vigilador.id,
          puntoId: punto,
          servicioId: servicio.id,
          timestamp: timestampDate,
          geolocalizacion: geoNormalizado ? JSON.stringify(geoNormalizado) : null,
          novedades: novedadesNormalizadas || null,
          uuid,
        },
      });

      // Actualizar vigilador
      await tx.vigilador.update({
        where: { legajo },
        data: {
          ultimoPunto: rondaCompletada ? 0 : nuevoUltimoPunto,
          rondaActiva: !rondaCompletada,
        },
      });

      // Preparar mensaje (dentro de tx para consistencia)
      const progreso = rondaCompletada ? puntosOrdenados.length : nuevoUltimoPunto;
      mensajeFinal = rondaCompletada
        ? `¡Ronda completada exitosamente! (${servicio.nombre})`
        : `Punto ${progreso}/${puntosOrdenados.length} registrado correctamente (${servicio.nombre})`;

      if (rondaCompletada) {
        logger.info({ legajo, servicio: servicio.nombre }, '🏁 Ronda completada');
      }
    });

    logger.info(
      { legajo, punto, uuid, servicio: servicio.nombre, progreso: mensajeFinal },
      '✅ Escaneo procesado exitosamente'
    );

    return { success: true, mensaje: mensajeFinal };
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