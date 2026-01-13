"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/reporteRoutes.ts
const express_1 = require("express");
const reporteService_1 = require("../services/reporteService");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const zod_1 = require("zod");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Schema Zod reutilizable (DRY con el de reporteService)
const ReporteQuerySchema = zod_1.z.object({
    servicioId: zod_1.z.string().uuid({ message: 'servicioId debe ser UUID válido' }),
    fechaDesde: zod_1.z.string().datetime({ offset: true }).optional(),
    fechaHasta: zod_1.z.string().datetime({ offset: true }).optional(),
    vigiladorId: zod_1.z.string().uuid().optional(),
});
router.get('/rondas', authMiddleware_1.requireAuth, async (req, res, next) => {
    try {
        // Validación runtime + inferencia de tipo
        const filtros = ReporteQuerySchema.parse(req.query);
        logger_1.default.info({ filtros, user: req.user }, '📥 Request a /api/reportes/rondas autenticada');
        const reportes = await reporteService_1.ReporteService.getReportesRondas(filtros);
        res.json(reportes);
    }
    catch (err) {
        next(err); // Usa handler global de errores
    }
});
exports.default = router;
//# sourceMappingURL=reporteRoutes.js.map