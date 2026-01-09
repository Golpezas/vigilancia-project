"use strict";
// src/services/reporteService.ts
// Servicio para reportes multi-cliente - Agregaciones dinámicas, validación tiempos
// Mejores prácticas 2026: Prisma raw queries para perf, caching con Redis (opcional), JSDoc completa
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReporteService = void 0;
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const dateUtils_1 = require("../utils/dateUtils"); // Normalización zona
const errorHandler_1 = require("../utils/errorHandler");
// Schema Zod para filtros de reportes (validación estricta)
const ReporteFiltroSchema = zod_1.z.object({
    servicioId: zod_1.z.string().uuid(),
    fechaDesde: zod_1.z.string().datetime().optional(),
    fechaHasta: zod_1.z.string().datetime().optional(),
    vigiladorId: zod_1.z.string().uuid().optional(),
});
class ReporteService {
    /**
     * Obtiene reportes de rondas por servicio, con detección de incumplimientos.
     * @param filtros Filtros validados (servicio obligatorio por seguridad multi-cliente)
     * @returns Array de rondas con métricas (completas, delays, etc.)
     */
    static async getReportesRondas(filtros) {
        const parsed = ReporteFiltroSchema.parse(filtros);
        // Query Prisma: Registros por servicio, ordenados por timestamp
        const registros = await vigiladorRepository_1.prisma.registro.findMany({
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
                punto: true, // Nombre punto
            },
            orderBy: { timestamp: 'asc' },
        });
        if (!registros.length) {
            throw new errorHandler_1.ValidationError('No hay registros para los filtros proporcionados');
        }
        // Agregación: Agrupar por vigilador y detectar rondas (lógica secuencial)
        const rondasPorVigilador = {};
        registros.forEach(reg => {
            const key = reg.vigiladorId;
            if (!rondasPorVigilador[key])
                rondasPorVigilador[key] = [];
            rondasPorVigilador[key].push({
                punto: reg.punto.nombre,
                timestamp: (0, dateUtils_1.toArgentinaTime)(reg.timestamp), // Normalizado
                geo: reg.geolocalizacion ? JSON.parse(reg.geolocalizacion) : null,
                novedades: reg.novedades,
            });
        });
        // Detección incumplimientos (ej: tiempo max 15min entre puntos)
        const MAX_TIEMPO_ENTRE_PUNTOS = 15 * 60 * 1000; // ms
        Object.entries(rondasPorVigilador).forEach(([vigiladorId, ronda]) => {
            for (let i = 1; i < ronda.length; i++) {
                const diff = new Date(ronda[i].timestamp).getTime() - new Date(ronda[i - 1].timestamp).getTime();
                if (diff > MAX_TIEMPO_ENTRE_PUNTOS) {
                    ronda[i].alerta = `Delay excesivo: ${Math.round(diff / 60000)} min`;
                }
            }
        });
        logger_1.default.info({ filtros: parsed, count: registros.length }, '✅ Reporte generado');
        return rondasPorVigilador;
    }
}
exports.ReporteService = ReporteService;
