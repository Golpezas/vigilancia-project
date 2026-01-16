"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reporteService_1 = require("../services/reporteService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
const ReporteQuerySchema = zod_1.z.object({
    servicioId: zod_1.z.string().uuid({ message: 'servicioId debe ser UUID válido' }),
    fechaDesde: zod_1.z.string()
        .datetime({ offset: true, message: 'fechaDesde debe ser ISO 8601 válido con offset' })
        .optional()
        .transform(val => val ? new Date(val) : undefined),
    fechaHasta: zod_1.z.string()
        .datetime({ offset: true, message: 'fechaHasta debe ser ISO 8601 válido con offset' })
        .optional()
        .transform(val => val ? new Date(val) : undefined),
    vigiladorId: zod_1.z.string().uuid().optional(),
});
router.get('/rondas', (0, authMiddleware_1.requireAuth)(['ADMIN', 'CLIENT']), async (req, res, next) => {
    try {
        const filtros = ReporteQuerySchema.parse(req.query);
        logger_1.default.info({
            rawQuery: req.query,
            parsedFiltros: {
                servicioId: filtros.servicioId,
                fechaDesde: filtros.fechaDesde?.toISOString(),
                fechaHasta: filtros.fechaHasta?.toISOString(),
                vigiladorId: filtros.vigiladorId,
            },
            userId: req.user?.id,
            role: req.user?.role,
        }, '✅ Query validada y transformada a objetos Date');
        const reportes = await reporteService_1.ReporteService.getReportesRondas(filtros);
        logger_1.default.debug({ count: Object.keys(reportes).length }, 'Reporte generado exitosamente');
        res.json(reportes);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            logger_1.default.warn({
                issues: err.issues,
                rawQuery: req.query,
            }, '⚠️ Falló validación Zod en reportes/rondas');
            return res.status(400).json({
                error: 'Parámetros de fecha inválidos',
                details: err.errors,
            });
        }
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=reporteRoutes.js.map