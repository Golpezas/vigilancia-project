// src/services/vigiladorService.ts
// Lógica de negocio principal - Validación secuencial, normalización de data y logging estructurado Pino 2026
// Mejores prácticas aplicadas: type-safety estricta, early validation, logging pre-throw para auditoría, JSDoc completo
// Nueva estructura 2026: Configuración dinámica de MAX_PUNTOS vía Prisma count (escalable a múltiples servicios)

import { PrismaClient } from '@prisma/client'; // ← Import para count dinámico (normalización vía DB)
import { VigiladorRepository } from '../repositories/vigiladorRepository';
import type { SubmitRegistroData, VigiladorEstado } from '../types/index';
import { normalizeGeo, normalizeNovedades } from '../utils/normalizer';
import { ForbiddenError, ValidationError } from '../utils/errorHandler';
import logger from '../utils/logger'; // Logger centralizado Pino

const prisma = new PrismaClient(); // Instancia compartida (best practice: singleton en service layer)

export class VigiladorService {
  /**
   * Procesa el escaneo de un punto QR.
   * Valida secuencia estricta (1→2→...→MAX→1), normaliza datos y persiste registro.
   * MAX_PUNTOS dinámico vía prisma.count (escalable, consistente con seed).
   * Preparado para multi-servicio: Futuro filtro by servicioId en count.
   * @param data Datos validados desde controller (SubmitRegistroData)
   * @returns Respuesta normalizada para frontend
   */
  static async procesarEscaneo(data: SubmitRegistroData): Promise<{ success: true; mensaje: string }> {
    const { nombre, legajo, punto, novedades, timestamp, geo } = data; // ← Asegúrate de destructurar timestamp

    // Obtener MAX_PUNTOS dinámicamente (normalización vía DB - evita hardcode, consistente con seed/qrs-config)
    const maxPuntos = await prisma.punto.count(); // ← Dinámico: 6 actual, escalable a N (futuro: { where: { servicioId } })
    logger.debug({ maxPuntos }, '🔢 MAX_PUNTOS cargado dinámicamente desde DB');

    // Validaciones básicas (early fail - mejor práctica, con rango dinámico)
    if (punto < 1 || punto > maxPuntos) {
      logger.warn({ legajo, punto, maxPuntos }, '⚠️ Punto fuera de rango dinámico');
      throw new ValidationError(`Punto debe estar entre 1 y ${maxPuntos}`);
    }

    // Obtener o crear vigilador (idempotente)
    const vigilador: VigiladorEstado = await VigiladorRepository.findOrCreate(legajo, nombre.trim());

    // Validación secuencial con logging pre-throw (auditoría completa, estructura escalable)
    if (vigilador.ultimoPunto + 1 !== punto) {
      if (!(vigilador.ultimoPunto === maxPuntos && punto === 1)) { // ← Dinámico: Reset al completar MAX (continuidad 6→1)
        const expected = vigilador.ultimoPunto + 1;
        const errMsg = `Secuencia inválida. Último punto registrado: ${vigilador.ultimoPunto}. Esperado: ${expected}`;

        logger.warn({ legajo, punto, ultimoPunto: vigilador.ultimoPunto, expected, maxPuntos }, '⚠️ Intento de secuencia inválida');
        throw new ForbiddenError(errMsg);
      }

      // Caso reset: Continuidad al final de ronda (mejor práctica: logging para traceability)
      logger.info({ legajo, maxPuntos }, '🔄 Reiniciando ronda desde Punto MAX a 1');
      await VigiladorRepository.updateUltimoPunto(legajo, 0, false); // Reset a 0, rondaActiva false opcional
    }

    // Normalización de datos (DRY - centralizado en utils)
    const geoNormalizado = normalizeGeo(geo);
    const novedadesNormalizadas = normalizeNovedades(novedades);

    // Persistencia del registro (estructura desacoplada)
    await VigiladorRepository.crearRegistro(
    vigilador.id,
    punto,
    new Date(timestamp), // ← Usa timestamp que SÍ existe en SubmitRegistroData
    geoNormalizado,
    novedadesNormalizadas
  );

    // Actualización de estado del vigilador (dinámico con MAX)
    const nuevoUltimo = punto === maxPuntos ? 0 : punto; // Reset al completar ronda
    const rondaActiva = punto !== maxPuntos;
    await VigiladorRepository.updateUltimoPunto(legajo, nuevoUltimo, rondaActiva);

    // Mensaje de éxito normalizado (dinámico para multi-servicio futuro)
    const mensaje = punto === maxPuntos ? '¡Ronda completada exitosamente!' : 'Punto registrado correctamente';

    logger.info({ legajo, punto, mensaje, maxPuntos }, '✅ Escaneo procesado exitosamente');

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

  // Cierra conexión Prisma al finalizar (best practice: cleanup en shutdown)
  static async disconnect() {
    await prisma.$disconnect();
  }
}