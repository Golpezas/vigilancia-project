"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod'; // ← En .env: JWT_SECRET=tu_clave_secreta_fuerte
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        logger_1.default.warn({ path: req.path, ip: req.ip }, '⚠️ Acceso sin token');
        throw new errorHandler_1.ValidationError('Token de autenticación requerido');
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET); // Type assertion segura
        req.user = decoded; // Adjunta al request (type-safety: extiende Request en types/express.d.ts si necesitas global)
        if (req.query.servicioId && req.query.servicioId !== decoded.servicioId) {
            throw new errorHandler_1.ForbiddenError('Acceso denegado: servicio no autorizado');
        }
        logger_1.default.info({ userId: decoded.userId, servicioId: decoded.servicioId }, '✅ Autenticación JWT exitosa');
        next();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido en JWT';
        logger_1.default.error({ err: message, tokenSnippet: token.slice(0, 10) + '...' }, '🚨 Error en autenticación JWT');
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new errorHandler_1.ForbiddenError('Token expirado');
        }
        throw new errorHandler_1.ForbiddenError('Token inválido');
    }
};
exports.requireAuth = requireAuth;
