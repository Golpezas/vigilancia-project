// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial dinámica por servicio
// Mejores prácticas 2026: Conteo de puntos por servicio del vigilador (multi-cliente real)
// Type-safety estricta, early validation, logging Pino estructurado, JSDoc completo

import { VigiladorRepository, prisma } from '../repositories/vigiladorRepository'; // ← Import prisma exportado
import type { SubmitRegistroData, VigiladorEstado } from '../types/index';
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer';
import { ForbiddenError, ValidationError } from '../utils/errorHandler';
import logger from '../utils/logger';

export class VigiladorService {
  /**
   * Procesa el escaneo de un punto QR.
   * Valida secuencia estricta basada en los puntos asignados al servicio del vigilador.
   * Reinicio automático al completar la ronda del servicio.
   * @param data Datos validados desde controller
   * @returns Respuesta normalizada para frontend
   */
  static async procesarEscaneo(data: SubmitRegistroData): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo } = data;

    // Obtener vigilador (crea si no existe con servicio Default)
    const vigilador: VigiladorEstado = await VigiladorRepository.findOrCreate(legajo, nombre.trim());

    // Cargar vigilador con su servicio y puntos asociados (include anidado - eficiente)
    const vigiladorCompleto = await prisma.vigilador.findUnique({
      where: { legajo },
      include: {
        servicio: {
          include: {
            puntos: {
              include: { punto: true },
              orderBy: { punto: { id: 'asc' } }, // Orden natural por ID (1,2,3...)
            },
          },
        },
      },
    });

    if (!vigiladorCompleto?.servicio) {
      logger.error({ legajo }, 'Vigilador sin servicio asignado');
      throw new ValidationError('Error de configuración: vigilador sin servicio');
    }

    // Tipado explícito: sp es ServicioPunto con punto incluido
    const puntosDelServicio = vigiladorCompleto.servicio.puntos.map((sp: { punto: { id: number; nombre: string } }) => sp.punto);
    const totalPuntos = puntosDelServicio.length;

    if (totalPuntos === 0) {
      logger.error({ servicioId: vigiladorCompleto.servicio.id }, 'Servicio sin puntos asignados');
      throw new ValidationError('El servicio no tiene puntos configurados');
    }

    // Validación de rango dinámico
    if (punto < 1 || punto > totalPuntos) {
      logger.warn({ legajo, punto, totalPuntos }, '⚠️ Punto fuera de rango del servicio');
      throw new ValidationError(`Punto inválido: este servicio tiene ${totalPuntos} puntos (1-${totalPuntos})`);
    }

    // Validación secuencial dinámica
    const esperado = vigilador.ultimoPunto === 0 ? 1 : vigilador.ultimoPunto + 1;
    const esReinicioValido = punto === 1 && vigilador.ultimoPunto === totalPuntos;

    if (punto !== esperado && !esReinicioValido) {
      logger.warn(
        { legajo, punto, ultimoPunto: vigilador.ultimoPunto, esperado, totalPuntos },
        '⚠️ Intento de secuencia inválida'
      );
      throw new ForbiddenError(
        `Secuencia inválida. Último punto: ${vigilador.ultimoPunto}. Esperado: ${esperado}`
      );
    }

    // Normalización de datos
    const geoNormalizado = normalizeGeo(geo);
    const novedadesNormalizadas = normalizeNovedades(novedades);

    // Persistencia del registro
    await VigiladorRepository.crearRegistro(
      vigilador.id,
      punto,
      new Date(timestamp),
      geoNormalizado,
      novedadesNormalizadas
    );

    // Actualización de estado (dinámico por servicio)
    let mensaje: string;
    if (punto === totalPuntos) {
      await VigiladorRepository.updateUltimoPunto(legajo, 0, false);
      mensaje = '¡Ronda completada exitosamente!';
      logger.info({ legajo, totalPuntos }, '🔄 Ronda completada - reiniciando');
    } else {
      await VigiladorRepository.updateUltimoPunto(legajo, punto, true);
      mensaje = 'Punto registrado correctamente';
    }

    logger.info({ legajo, punto, totalPuntos, mensaje }, '✅ Escaneo procesado exitosamente');

    return { success: true, mensaje };
  }

  /**
   * Obtiene estado actual de un vigilador (para futura extensión frontend)
   * @param legajo Legajo único
   * @returns VigiladorEstado o null
   */
  static async getEstado(legajo: number): Promise<VigiladorEstado | null> {
    const estado = await VigiladorRepository.getEstado(legajo);
    if (estado) {
      logger.debug({ legajo, ultimoPunto: estado.ultimoPunto }, '🔍 Estado consultado');
    }
    return estado;
  }
}