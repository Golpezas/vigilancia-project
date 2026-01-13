"use strict";
// src/utils/errorHandler.ts
// Manejo centralizado de errores - Mejores prácticas 2026: herencia estricta, logging en creación, type-safety
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ForbiddenError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Logging early en creación (normalización para depuración)
        console.warn(`[AppError created] ${statusCode}: ${message}`); // Temporal para test; reemplaza con logger si Pino ready
        // Stack trace correcto en TS (best practice)
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, true);
    }
}
exports.ValidationError = ValidationError;
class ForbiddenError extends AppError {
    constructor(message = 'Acceso denegado') {
        super(message, 403, true);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado') {
        super(message, 404, true);
    }
}
exports.NotFoundError = NotFoundError;
//# sourceMappingURL=errorHandler.js.map