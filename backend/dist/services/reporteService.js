"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReporteService = void 0;
const vigiladorRepository_1 = require("../repositories/vigiladorRepository");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const dateUtils_1 = require("../utils/dateUtils");
const errorHandler_1 = require("../utils/errorHandler");
const ReporteFiltroSchema = zod_1.z.object({
    servicioId: zod_1.z.string().uuid(),
    fechaDesde: zod_1.z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
    fechaHasta: zod_1.z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
    vigiladorId: zod_1.z.string().uuid().optional(),
});
class ReporteService {
    static async getReportesRondas(filtros) {
        const { servicioId, fechaDesde, fechaHasta, vigiladorId } = filtros;
        logger_1.default.info({ servicioId, fechaDesde: fechaDesde?.toISOString(), fechaHasta: fechaHasta?.toISOString(), vigiladorId }, '📊 Iniciando generación de reporte de rondas');
        const registros = await vigiladorRepository_1.prisma.registro.findMany({
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
        if (!registros.length) {
            logger_1.default.info({ filtros }, 'No se encontraron registros para los filtros');
            throw new errorHandler_1.ValidationError('No hay registros para los filtros proporcionados');
        }
        const rondasPorVigilador = {};
        registros.forEach(reg => {
            const key = reg.vigiladorId;
            if (!rondasPorVigilador[key])
                rondasPorVigilador[key] = [];
            rondasPorVigilador[key].push({
                punto: reg.punto.nombre,
                timestamp: (0, dateUtils_1.toArgentinaTime)(reg.timestamp),
                geo: reg.geolocalizacion ? JSON.parse(reg.geolocalizacion) : null,
                novedades: reg.novedades,
            });
        });
        const MAX_TIEMPO_ENTRE_PUNTOS = 15 * 60 * 1000;
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
        logger_1.default.info({ filtros, totalRegistros: registros.length, vigiladores: Object.keys(rondasPorVigilador).length }, '✅ Reporte de rondas generado exitosamente');
        return rondasPorVigilador;
    }
}
exports.ReporteService = ReporteService;
//# sourceMappingURL=reporteService.js.map