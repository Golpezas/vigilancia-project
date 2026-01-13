"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../utils/logger"));
const errorHandler_1 = require("../utils/errorHandler");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no está configurado');
}
const requireAuth = (allowedRoles = ['ADMIN', 'CLIENT']) => {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            logger_1.default.warn({ path: req.path }, 'Intento de acceso sin token');
            throw new errorHandler_1.ValidationError('Token de autenticación requerido');
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = decoded;
            // Validación multi-cliente (scoping)
            if (decoded.role === 'CLIENT' && req.query.servicioId && req.query.servicioId !== decoded.servicioId) {
                throw new errorHandler_1.ForbiddenError('Acceso denegado: servicio no autorizado');
            }
            if (!allowedRoles.includes(decoded.role)) {
                throw new errorHandler_1.ForbiddenError('Rol no autorizado para esta operación');
            }
            next();
        }
        catch (err) {
            const msg = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido';
            logger_1.default.warn({ error: err.message, tokenPrefix: token.slice(0, 8) }, msg);
            throw new errorHandler_1.ForbiddenError(msg);
        }
    };
};
exports.requireAuth = requireAuth;
//# sourceMappingURL=authMiddleware.js.map