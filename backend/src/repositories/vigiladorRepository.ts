// src/repositories/vigiladorRepository.ts
// Capa de acceso a datos - Patrón Repository para desacoplar Prisma del negocio
// Mejores prácticas: type-safety total, normalización de data, documentación JSDoc
// Singleton Prisma exportado (DRY - evita múltiples conexiones)

import { PrismaClient } from '@prisma/client';
import type { VigiladorEstado, GeoLocation } from '../types/index'; // type-only import
import logger from '../utils/logger'; // ← Import centralizado del logger Pino
import { ValidationError } from '../utils/errorHandler'; // ← IMPORT CLAVE FALTANTE
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL; // De tu .env (normalizado)

if (!connectionString) {
  throw new Error('DATABASE_URL no configurado en .env'); // Validación early
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // ← Change to connectionString
});

const adapter = new PrismaPg(pool);  // No extra options needed

export const prisma = new PrismaClient({
  adapter, // ← Esto resuelve el error!
  log: ['query', 'info', 'warn', 'error'], // Logging normalizado
});

/**
 * Repository para operaciones con Vigilador y Registro
 * Desacopla la lógica de negocio del acceso a datos (SOLID - Single Responsibility)
 */
export class VigiladorRepository {
  /**
   * Busca vigilador por legajo. Si no existe, lo crea y asigna servicio basado en punto escaneado.
   * Lógica multi-servicio real 2026: infiere servicio del punto (sin "Default").
   * Type-safety estricta con Prisma generated types.
   * @param legajo Legajo único
   * @param nombre Nombre completo
   * @param puntoId ID del punto escaneado (para inferir servicio)
   * @returns VigiladorEstado con servicio asignado
   */
  static async findOrCreate(legajo: number, nombre: string, puntoId: number): Promise<VigiladorEstado> {
    // 1. Buscar vigilador existente
    const vigiladorExistente = await prisma.vigilador.findUnique({
      where: { legajo },
      include: { servicio: true },
    });

    if (vigiladorExistente) {
      logger.debug({ legajo, servicio: vigiladorExistente.servicio.nombre }, '🔍 Vigilador existente encontrado');
      return {
        id: vigiladorExistente.id,
        nombre: vigiladorExistente.nombre,
        legajo: vigiladorExistente.legajo,
        ultimoPunto: vigiladorExistente.ultimoPunto,
        rondaActiva: vigiladorExistente.rondaActiva,
      };
    }

    // 2. Inferir servicio desde el punto escaneado (puntos exclusivos por diseño actual)
    const servicioPunto = await prisma.servicioPunto.findFirst({
      where: {
        puntoId: puntoId,
      },
      include: {
        servicio: true, // ← Trae datos del servicio relacionado
      },
    });

    if (!servicioPunto || !servicioPunto.servicio) {
      logger.error({ legajo, puntoId }, '🚨 Punto escaneado no pertenece a ningún servicio configurado');
      throw new ValidationError('Punto inválido: no asignado a ningún cliente/servicio');
    }

    // Validación adicional (escalable para futuro con compartidos)
    const countAsignaciones = await prisma.servicioPunto.count({
      where: { puntoId },
    });
    if (countAsignaciones > 1) {
      logger.error({ puntoId, count: countAsignaciones }, '🚨 Punto compartido entre múltiples servicios - no permitido');
      throw new ValidationError('Error de configuración: punto asignado a múltiples clientes');
    }

    // 3. Crear nuevo vigilador con servicio inferido
    const nuevoVigilador = await prisma.vigilador.create({
      data: {
        nombre: nombre.trim(),
        legajo,
        servicioId: servicioPunto.servicio.id,
        ultimoPunto: 0,
        rondaActiva: false,
      },
      include: { servicio: true },
    });

    logger.info(
      {
        legajo,
        nombre: nuevoVigilador.nombre,
        servicio: servicioPunto.servicio.nombre,
        puntoId,
      },
      '🆕 Nuevo vigilador creado y asignado automáticamente al servicio correcto'
    );

    return {
      id: nuevoVigilador.id,
      nombre: nuevoVigilador.nombre,
      legajo: nuevoVigilador.legajo,
      ultimoPunto: nuevoVigilador.ultimoPunto,
      rondaActiva: nuevoVigilador.rondaActiva,
    };
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
   * Normaliza geolocalización a string JSON
   * @param vigiladorId - ID del vigilador
   * @param puntoId - ID del punto
   * @param timestamp - Fecha y hora del escaneo
   * @param geo - Geolocalización { lat, long } o null
   * @param novedades - Texto libre del vigilador (normalizado)
   * @param servicioId - ID del servicio asociado (obligatorio en multi-servicio)
   */
  static async crearRegistro(
    vigiladorId: string,
    puntoId: number,
    timestamp: Date,
    geo: GeoLocation | null,
    novedades: string,
    servicioId: string
  ) {
    await prisma.registro.create({
      data: {
        vigiladorId,
        puntoId,
        servicioId,         // ← Ahora se usa correctamente
        timestamp,
        geolocalizacion: geo ? JSON.stringify(geo) : null,
        novedades: novedades || null,
      },
    });

    logger.info(
      { vigiladorId, puntoId, servicioId, timestamp },
      '📝 Registro creado exitosamente'
    );
  }

  /**
   * Obtiene el vigilador completo con sus puntos ordenados por ID (secuencia natural)
   * @param legajo Legajo del vigilador
   * @returns Vigilador con servicio y lista ordenada de puntos asignados
   */
  static async findByLegajoWithPuntos(legajo: number) {
    return await prisma.vigilador.findUnique({
      where: { legajo },
      include: {
        servicio: {
          include: {
            puntos: {
              include: { punto: true },
              orderBy: { punto: { id: 'asc' } }, // Secuencia estricta por ID ascendente
            },
          },
        },
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