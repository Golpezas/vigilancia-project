// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial, normalización de data y logging estructurado Pino 2026
// Mejores prácticas aplicadas: type-safety estricta, early validation, logging pre-throw para auditoría, JSDoc completo

import { VigiladorRepository } from '../repositories/vigiladorRepository';
import type { SubmitRegistroData, VigiladorEstado } from '../types/index';
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer';
import { ForbiddenError, ValidationError } from '../utils/errorHandler';
import logger from '../utils/logger'; // ← Import centralizado del logger Pino (resuelve Cannot find name 'logger')

export class VigiladorService {
  /**
   * Procesa el escaneo de un punto QR.
   * Valida secuencia estricta (1→2→...→10→1), normaliza datos y persiste registro.
   * @param data Datos validados desde controller (SubmitRegistroData)
   * @returns Respuesta normalizada para frontend
   */
  static async procesarEscaneo(data: SubmitRegistroData): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo } = data;

    // Validaciones básicas (early fail - mejor práctica)
    if (punto < 1 || punto > 10) {
      logger.warn({ legajo, punto }, '⚠️ Punto fuera de rango permitido (1-10)');
      throw new ValidationError('Punto debe estar entre 1 y 10');
    }

    // Obtener o crear vigilador (idempotente)
    const vigilador: VigiladorEstado = await VigiladorRepository.findOrCreate(legajo, nombre.trim());

    // Validación secuencial CRÍTICA con logging estructurado pre-throw (auditoría completa)
    if (vigilador.ultimoPunto + 1 !== punto) {
      if (!(vigilador.ultimoPunto === 10 && punto === 1)) {
        const expected = vigilador.ultimoPunto + 1;
        const errMsg = `Secuencia inválida. Último punto registrado: ${vigilador.ultimoPunto}. Esperado: ${expected}`;

        // ← Logging warn con contexto completo (Pino-compliant: objeto primero, mensaje segundo)
        logger.warn({ legajo, punto, ultimoPunto: vigilador.ultimoPunto, expected }, '⚠️ Intento de secuencia inválida');

        // Throw error operacional (capturado en handler global → 403 con mensaje descriptivo)
        throw new ForbiddenError(errMsg);
      }

      // Caso válido: reinicio de ronda tras completar Punto 10
      logger.info({ legajo }, '🔄 Reiniciando ronda desde Punto 10 a 1');
      await VigiladorRepository.updateUltimoPunto(legajo, 0, false); // Resetea ultimoPunto y rondaActiva opcional
    }

    // Normalización de datos (DRY - centralizado en utils)
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

    // Actualización de estado del vigilador
    const nuevoUltimo = punto === 10 ? 0 : punto; // Reset al completar ronda
    const rondaActiva = punto !== 10;
    await VigiladorRepository.updateUltimoPunto(legajo, nuevoUltimo, rondaActiva);

    // Mensaje de éxito normalizado
    const mensaje = punto === 10 ? '¡Ronda completada exitosamente!' : 'Punto registrado correctamente';

    logger.info({ legajo, punto, mensaje }, '✅ Escaneo procesado exitosamente');

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