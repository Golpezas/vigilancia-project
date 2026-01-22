// src/controllers/vigiladorController.ts
// Controlador para rutas de vigilador - Mejores prácticas 2026: Validación Zod runtime, idempotencia con UUID, logging Pino estructurado
// Type-safety: Extendemos SubmitRegistroData con uuid opcional (fallback generado aquí)
// Depuración: Logs extras en dev, contexto completo para traceability (IP, UA, UUID)
// Documentación: JSDoc completa con params, returns, throws

import { Request, Response, NextFunction } from 'express';
import { VigiladorService } from '../services/vigiladorService';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { SubmitRegistroData } from '../types/index';
import { ValidationError } from '../utils/errorHandler';
import logger from '../utils/logger';

// Esquema Zod extendido: Agregamos uuid optional (fallback en controller para idempotencia)
const SubmitSchema = z.object({
  nombre: z.string().min(1).trim(),
  legajo: z.number().int().positive(),
  punto: z.number().int().min(1), // Removemos max(10) - configurable por servicio
  novedades: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }), // ISO normalizado
  geo: z.object({
    lat: z.number().nullable(),
    long: z.number().nullable(),
  }).optional(),
  uuid: z.string().uuid().optional(), // Optional aquí, required en service
});

export class VigiladorController {
  /**
   * Maneja el envío de un registro de escaneo.
   * - Valida con Zod, genera UUID si falta (warn para depurar frontend).
   * - Delega al service para procesamiento atómico.
   * - Logging: Estructurado, con IP/UA para security audits.
   * @param req Request con body validado
   * @param res Response para JSON success/error
   * @param next Next para propagar errores
   */
  static async submit(req: Request, res: Response, next: NextFunction) {
    const context = {
      body: req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    logger.info(context, '📥 Nueva request a /api/submit');

    try {
      const parseResult = SubmitSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const errMsg = `Datos inválidos: ${firstIssue.path.join('.')} - ${firstIssue.message}`;
        logger.warn({ issues: parseResult.error.issues, ...context }, '⚠️ Validación Zod fallida');
        throw new ValidationError(errMsg);
      }

      let data = parseResult.data as SubmitRegistroData & { uuid: string };

      // Fallback UUID: Generar si no viene (pero warn para fix en frontend)
      if (!data.uuid) {
        data.uuid = uuidv4();
        logger.warn({ ...context, generatedUuid: data.uuid }, '⚠️ UUID no provisto por frontend - generado en server (recomienda fix client-side)');
      }

      if (process.env.NODE_ENV === 'development') {
        logger.debug({ data }, '✅ Datos validados y normalizados (dev mode)');
      }

      const result = await VigiladorService.procesarEscaneo(data);
      logger.info({ result, uuid: data.uuid }, '✅ Procesado exitoso');

      res.json(result);
    } catch (err: unknown) {
      const errorContext = {
        message: (err as Error).message,
        stack: (err as Error).stack,
        ...context,
      };
      logger.error(errorContext, '❌ Error en submit');
      next(err);
    }
  }

  /**
   * Obtiene el estado de un vigilador por legajo.
   * - Valida legajo early.
   * - Delega al service.
   * - Logging: Con IP para audits.
   * @param req Request con params.legajo
   * @param res Response con estado JSON
   * @param next Next para errores
   */
  static async getEstado(req: Request, res: Response, next: NextFunction) {
    const context = {
      legajo: req.params.legajo,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    logger.info(context, '📥 Request a /api/estado/:legajo');

    try {
      const legajo = parseInt(req.params.legajo, 10);
      if (isNaN(legajo) || legajo <= 0) {
        logger.warn({ param: req.params.legajo, ...context }, '⚠️ Legajo no numérico o inválido');
        throw new ValidationError('Legajo inválido: debe ser un entero positivo');
      }

      const estado = await VigiladorService.getEstado(legajo);
      logger.debug({ progreso: estado.progreso, ...context }, '✅ Estado encontrado y normalizado');

      res.json(estado);
    } catch (err: unknown) {
      const errorContext = {
        message: (err as Error).message,
        stack: (err as Error).stack,
        params: req.params,
        ...context,
      };
      logger.error(errorContext, '❌ Error en getEstado');
      next(err);
    }
  }
}