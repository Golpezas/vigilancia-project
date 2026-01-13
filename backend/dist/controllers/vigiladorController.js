"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VigiladorController = void 0;
const vigiladorService_1 = require("../services/vigiladorService");
const zod_1 = require("zod");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const SubmitSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1).trim(),
    legajo: zod_1.z.number().int().positive(),
    punto: zod_1.z.number().int().min(1).max(10),
    novedades: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().datetime({ offset: true }),
    geo: zod_1.z.object({
        lat: zod_1.z.number().nullable(),
        long: zod_1.z.number().nullable(),
    }).optional(),
});
class VigiladorController {
    static async submit(req, res, next) {
        logger_1.default.info({ body: req.body }, '📥 Nueva request a /api/submit');
        try {
            const parseResult = SubmitSchema.safeParse(req.body);
            if (!parseResult.success) {
                const firstIssue = parseResult.error.issues[0];
                const errMsg = `Datos inválidos: ${firstIssue.path.join('.')} - ${firstIssue.message}`;
                logger_1.default.warn({ issues: parseResult.error.issues }, '⚠️ Validación fallida');
                throw new errorHandler_1.ValidationError(errMsg);
            }
            const data = parseResult.data;
            logger_1.default.debug({ data }, '✅ Datos validados');
            const result = await vigiladorService_1.VigiladorService.procesarEscaneo(data);
            logger_1.default.info({ result }, '✅ Procesado exitoso');
            res.json(result);
        }
        catch (err) {
            const errorContext = {
                message: err.message,
                stack: err.stack,
                body: req.body,
            };
            logger_1.default.error(errorContext, '❌ Error en submit');
            next(err);
        }
    }
    static async getEstado(req, res, next) {
        logger_1.default.info({ legajo: req.params.legajo, ip: req.ip }, '📥 Request a /api/estado/:legajo');
        try {
            const legajo = parseInt(req.params.legajo, 10);
            if (isNaN(legajo) || legajo <= 0) {
                logger_1.default.warn({ param: req.params.legajo }, '⚠️ Legajo no numérico o inválido');
                throw new errorHandler_1.ValidationError('Legajo inválido: debe ser un entero positivo');
            }
            const estado = await vigiladorService_1.VigiladorService.getEstado(legajo);
            logger_1.default.debug({ legajo, progreso: estado.progreso }, '✅ Estado encontrado y normalizado');
            res.json(estado);
        }
        catch (err) {
            const errorContext = {
                message: err.message,
                stack: err.stack,
                params: req.params,
                ip: req.ip,
            };
            logger_1.default.error(errorContext, '❌ Error en getEstado');
            next(err);
        }
    }
}
exports.VigiladorController = VigiladorController;
//# sourceMappingURL=vigiladorController.js.map