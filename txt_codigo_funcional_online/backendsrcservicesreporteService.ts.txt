// src/services/reporteService.ts
// Servicio para reportes multi-cliente - Agregaciones dinámicas, validación tiempos
// Mejores prácticas 2026: Prisma raw queries para perf, caching con Redis (opcional), JSDoc completa

import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { toArgentinaTime } from '../utils/dateUtils';
//import { ValidationError } from '../utils/errorHandler';

// Schema Zod para filtros (acepta offset, transforma a Date)
const ReporteFiltroSchema = z.object({
  servicioId: z.string().uuid(),
  fechaDesde: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  fechaHasta: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  vigiladorId: z.string().uuid().optional(),
});

type ReporteFiltros = z.infer<typeof ReporteFiltroSchema>;

export class ReporteService {
  /**
   * Obtiene reportes de rondas por servicio, con detección de incumplimientos.
   * - Delays: si diff entre timestamps consecutivos >1 hora (configurable), agrega alerta.
   * - Si no hay registros, retorna {} vacío (no error, para UX amigable).
   * @param filtros Filtros validados (servicio obligatorio)
   * @returns Rondas agrupadas por vigilador con alertas
   */
  static async getReportesRondas(filtros: ReporteFiltros) {
    const { servicioId, fechaDesde, fechaHasta, vigiladorId } = filtros;

    logger.info(
      { servicioId, fechaDesde: fechaDesde?.toISOString(), fechaHasta: fechaHasta?.toISOString(), vigiladorId },
      '📊 Iniciando generación de reporte de rondas'
    );

    const registros = await prisma.registro.findMany({
      where: {
        servicioId,
        timestamp: {
          gte: fechaDesde,
          lte: fechaHasta,
        },
        vigiladorId,
      },
      include: {
        vigilador: true, // Para nombre/legajo
        punto: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    if (!registros.length) {
      logger.info({ filtros }, 'ℹ️ No se encontraron registros - retornando vacío');
      return {}; // Vacío para no-data UX
    }

    // Agrupación por vigilador con nombre/legajo (para frontend legible)
    const rondasPorVigilador: Record<string, any[]> = {};
    registros.forEach(reg => {
      const key = `${reg.vigilador.nombre} - Legajo ${reg.vigilador.legajo}`; // Normalización para UX
      if (!rondasPorVigilador[key]) rondasPorVigilador[key] = [];
      rondasPorVigilador[key].push({
        punto: reg.punto.nombre,
        timestamp: toArgentinaTime(reg.timestamp),
        geo: reg.geolocalizacion ? JSON.parse(reg.geolocalizacion) : null,
        novedades: reg.novedades,
      });
    });

    // Detección de delays (configurable, >1 hora)
    const MAX_TIEMPO_ENTRE_PUNTOS = 60 * 60 * 1000; // 1 hora (cambia si needed)
    Object.values(rondasPorVigilador).forEach(ronda => {
      for (let i = 1; i < ronda.length; i++) {
        const prevTime = new Date(ronda[i - 1].timestamp).getTime();
        const currTime = new Date(ronda[i].timestamp).getTime();
        const diff = currTime - prevTime;
        if (diff > MAX_TIEMPO_ENTRE_PUNTOS) {
          ronda[i].alerta = `Delay excesivo: ${Math.round(diff / 60000)} min`;
          logger.debug({ diffMin: Math.round(diff / 60000) }, '⚠️ Delay detectado');
        }
      }
    });

    logger.info(
      { filtros, totalRegistros: registros.length, vigiladores: Object.keys(rondasPorVigilador).length },
      '✅ Reporte de rondas generado exitosamente'
    );

    return rondasPorVigilador;
  }

  // TODO: Agregar método para alertas en tiempo real (e.g., cron job o webhook)
}