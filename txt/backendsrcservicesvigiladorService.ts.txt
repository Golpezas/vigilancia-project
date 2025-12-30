// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial y normalización

import { VigiladorRepository } from '../repositories/vigiladorRepository'; // ← .js
import type { SubmitRegistroData, VigiladorEstado } from '../types/index'; // ← .js
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer'; // ← .js
import { ForbiddenError, ValidationError } from '../utils/errorHandler'; // ← .js

export class VigiladorService {
  /**
   * Procesa el envío de un punto escaneado
   * Valida secuencia, normaliza datos y persiste
   */
  static async procesarEscaneo(data: SubmitRegistroData): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo } = data;

    // Validaciones básicas
    if (punto < 1 || punto > 10) {
      throw new ValidationError('Punto debe estar entre 1 y 10');
    }

    // Obtener o crear vigilador
    const vigilador: VigiladorEstado = await VigiladorRepository.findOrCreate(legajo, nombre);

    // Validación secuencial CRÍTICA
    if (vigilador.ultimoPunto + 1 !== punto) {
      // Permitir reinicio si escanea Punto 1 y último fue 10 (ronda completa)
      if (!(vigilador.ultimoPunto === 10 && punto === 1)) {
        throw new ForbiddenError(
          `Secuencia inválida. Último punto registrado: ${vigilador.ultimoPunto}. Esperado: ${vigilador.ultimoPunto + 1}`
        );
      }
      // Si es reinicio, reseteamos
      await VigiladorRepository.updateUltimoPunto(legajo, 0);
    }

    // Normalización de datos
    const geoNormalizado = normalizeGeo(geo);
    const novedadesNormalizadas = normalizeNovedades(novedades);

    // Persistencia
    await VigiladorRepository.crearRegistro(
      vigilador.id,
      punto,
      new Date(timestamp),
      geoNormalizado, // ya es GeoLocation | null
      novedadesNormalizadas
    );

    // Actualizar estado (si completa ronda 10 → reset opcional)
    const nuevoUltimo = punto === 10 ? 0 : punto;
    const rondaActiva = punto !== 10;
    await VigiladorRepository.updateUltimoPunto(legajo, nuevoUltimo, rondaActiva);

    return {
      success: true,
      mensaje: punto === 10 ? '¡Ronda completada exitosamente!' : 'Punto registrado correctamente',
    };
  }

  /**
   * Obtiene estado actual (útil para frontend)
   */
  static async getEstado(legajo: number) {
    return await VigiladorRepository.getEstado(legajo);
  }
}