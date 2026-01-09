// src/services/reporteService.ts
// Servicio para reportes multi-cliente - Agregaciones dinámicas, validación tiempos
// Mejores prácticas 2026: Prisma raw queries para perf, caching con Redis (opcional), JSDoc completa

import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { toArgentinaTime } from '../utils/dateUtils'; // Normalización zona
import { ValidationError } from '../utils/errorHandler';

// Schema Zod para filtros de reportes (validación estricta)
const ReporteFiltroSchema = z.object({
  servicioId: z.string().uuid(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  vigiladorId: z.string().uuid().optional(),
});

export class ReporteService {
  /**
   * Obtiene reportes de rondas por servicio, con detección de incumplimientos.
   * @param filtros Filtros validados (servicio obligatorio por seguridad multi-cliente)
   * @returns Array de rondas con métricas (completas, delays, etc.)
   */
  static async getReportesRondas(filtros: z.infer<typeof ReporteFiltroSchema>) {
    const parsed = ReporteFiltroSchema.parse(filtros);

    // Query Prisma: Registros por servicio, ordenados por timestamp
    const registros = await prisma.registro.findMany({
      where: {
        servicioId: parsed.servicioId,
        timestamp: {
          gte: parsed.fechaDesde ? new Date(parsed.fechaDesde) : undefined,
          lte: parsed.fechaHasta ? new Date(parsed.fechaHasta) : undefined,
        },
        vigiladorId: parsed.vigiladorId,
      },
      include: {
        vigilador: true, // Nombre/legajo
        punto: true,     // Nombre punto
      },
      orderBy: { timestamp: 'asc' },
    });

    if (!registros.length) {
      throw new ValidationError('No hay registros para los filtros proporcionados');
    }

    // Agregación: Agrupar por vigilador y detectar rondas (lógica secuencial)
    const rondasPorVigilador: Record<string, any[]> = {};
    registros.forEach(reg => {
      const key = reg.vigiladorId;
      if (!rondasPorVigilador[key]) rondasPorVigilador[key] = [];
      rondasPorVigilador[key].push({
        punto: reg.punto.nombre,
        timestamp: toArgentinaTime(reg.timestamp), // Normalizado
        geo: reg.geolocalizacion ? JSON.parse(reg.geolocalizacion) : null,
        novedades: reg.novedades,
      });
    });

    // Detección incumplimientos (ej: tiempo max 15min entre puntos)
    const MAX_TIEMPO_ENTRE_PUNTOS = 15 * 60 * 1000; // ms
    Object.entries(rondasPorVigilador).forEach(([vigiladorId, ronda]) => {
      for (let i = 1; i < ronda.length; i++) {
        const diff = new Date(ronda[i].timestamp).getTime() - new Date(ronda[i-1].timestamp).getTime();
        if (diff > MAX_TIEMPO_ENTRE_PUNTOS) {
          ronda[i].alerta = `Delay excesivo: ${Math.round(diff / 60000)} min`;
        }
      }
    });

    logger.info({ filtros: parsed, count: registros.length }, '✅ Reporte generado');
    return rondasPorVigilador;
  }

  // TODO: Agregar método para alertas en tiempo real (e.g., cron job o webhook)
}