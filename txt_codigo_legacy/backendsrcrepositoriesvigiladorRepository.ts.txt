// src/repositories/vigiladorRepository.ts
// Capa de acceso a datos - Patrón Repository para desacoplar Prisma del negocio
// Mejores prácticas: type-safety total, normalización de data, documentación JSDoc

import { PrismaClient } from '@prisma/client';
import type { VigiladorEstado, GeoLocation } from '../types/index'; // type-only import

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Opcional: logging para depuración en desarrollo
});

/**
 * Repository para operaciones con Vigilador y Registro
 * Desacopla la lógica de negocio del acceso a datos (SOLID - Single Responsibility)
 */
export class VigiladorRepository {
  /**
   * Busca un vigilador por legajo o lo crea si no existe
   * Normaliza el nombre (trim)
   * @param legajo - Legajo único del vigilador
   * @param nombre - Nombre completo
   * @returns VigiladorEstado con id y datos
   */
  static async findOrCreate(legajo: number, nombre: string): Promise<VigiladorEstado> {
    let vigilador = await prisma.vigilador.findUnique({
      where: { legajo },
    });

    if (!vigilador) {
      vigilador = await prisma.vigilador.create({
        data: {
          nombre: nombre.trim(),
          legajo,
          ultimoPunto: 0,
          rondaActiva: false,
        },
      });
    }

    return vigilador as VigiladorEstado;
  }

  /**
   * Obtiene el estado actual del vigilador
   * @param legajo - Legajo del vigilador
   * @returns VigiladorEstado o null si no existe
   */
  static async getEstado(legajo: number): Promise<VigiladorEstado | null> {
    const vigilador = await prisma.vigilador.findUnique({
      where: { legajo },
    });

    return vigilador as VigiladorEstado | null;
  }

  /**
   * Actualiza el último punto escaneado y estado de ronda
   * @param legajo - Legajo del vigilador
   * @param punto - Nuevo último punto
   * @param activa - Estado de ronda activa (default true)
   */
  static async updateUltimoPunto(legajo: number, punto: number, activa: boolean = true) {
    await prisma.vigilador.update({
      where: { legajo },
      data: {
        ultimoPunto: punto,
        rondaActiva: activa,
      },
    });
  }

  /**
   * Crea un registro de escaneo
   * Normaliza geolocalización a string JSON (compatible con SQLite String @db.Text)
   * @param vigiladorId - ID del vigilador
   * @param puntoId - ID del punto
   * @param timestamp - Fecha y hora del escaneo
   * @param geo - Geolocalización { lat, long } o null
   * @param novedades - Texto libre del vigilador
   */
  static async crearRegistro(
    vigiladorId: string,
    puntoId: number,
    timestamp: Date,
    geo: GeoLocation | null,
    novedades: string
  ) {
    await prisma.registro.create({
      data: {
        vigiladorId,
        puntoId,
        timestamp,
        geolocalizacion: geo ? JSON.stringify(geo) : null, // ← Normalización a string
        novedades: novedades || null,
      },
    });
  }

  /**
   * Cierra la conexión Prisma al finalizar la app (best practice)
   */
  static async disconnect() {
    await prisma.$disconnect();
  }
}