// src/utils/errorHandler.ts
// Manejo centralizado de errores - Mejores prácticas 2026: herencia estricta, logging en creación, type-safety

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Logging early en creación (normalización para depuración)
    console.warn(`[AppError created] ${statusCode}: ${message}`); // Temporal para test; reemplaza con logger si Pino ready

    // Stack trace correcto en TS (best practice)
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acceso denegado') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404, true);
  }
}