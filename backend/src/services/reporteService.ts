// src/services/reporteService.ts
// Servicio para reportes multi-cliente - Agregaciones dinámicas, validación tiempos
// Mejores prácticas 2026: Prisma raw queries para perf, caching con Redis (opcional), JSDoc completa

import { prisma } from '../repositories/vigiladorRepository';
import { z } from 'zod';
import logger from '../utils/logger';
import { toArgentinaTime } from '../utils/dateUtils';
import { ValidationError } from '../utils/errorHandler';

// Schema Zod actualizado: acepta ISO con offset y transforma directamente a Date
const ReporteFiltroSchema = z.object({
  servicioId: z.string().uuid(),
  fechaDesde: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  fechaHasta: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  vigiladorId: z.string().uuid().optional(),
});

// Tipo inferido automáticamente (type-safe y DRY)
type ReporteFiltros = z.infer<typeof ReporteFiltroSchema>;

export class ReporteService {
  /**
   * Obtiene reportes de rondas por servicio, con detección de incumplimientos.
   * @param filtros Filtros validados (servicio obligatorio por seguridad multi-cliente)
   * @returns Objeto con rondas agrupadas por vigilador y alertas de delay
   * @throws ValidationError si no hay registros para los filtros
   */
  static async getReportesRondas(filtros: ReporteFiltros) {
    // Ya no necesitamos volver a parsear porque la ruta ya lo hizo
    // Pero mantenemos la variable para claridad
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
        vigilador: true,
        punto: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Después (mejor UX y API más amigable)
    if (!registros.length) {
      logger.info({ filtros }, 'ℹ️ No se encontraron registros para los filtros - retornando vacío');
      return {}; // Retorna objeto vacío (RondasPorVigilador vacío)
      // O si preferís array: return { message: 'No hay rondas registradas para este período' }
    }

    // Agrupación por vigilador
    const rondasPorVigilador: Record<string, any[]> = {};
    registros.forEach(reg => {
      const key = reg.vigiladorId;
      if (!rondasPorVigilador[key]) rondasPorVigilador[key] = [];
      rondasPorVigilador[key].push({
        punto: reg.punto.nombre,
        timestamp: toArgentinaTime(reg.timestamp),
        geo: reg.geolocalizacion ? JSON.parse(reg.geolocalizacion) : null,
        novedades: reg.novedades,
      });
    });

    // Detección de delays (mejorado: evita crear new Date innecesariamente)
    const MAX_TIEMPO_ENTRE_PUNTOS = 15 * 60 * 1000; // 15 minutos en ms
    Object.values(rondasPorVigilador).forEach(ronda => {
      for (let i = 1; i < ronda.length; i++) {
        const prevTime = new Date(ronda[i - 1].timestamp).getTime();
        const currTime = new Date(ronda[i].timestamp).getTime();
        const diff = currTime - prevTime;
        if (diff > MAX_TIEMPO_ENTRE_PUNTOS) {
          ronda[i].alerta = `Delay excesivo: ${Math.round(diff / 60000)} min`;
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