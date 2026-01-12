// src/controllers/vigiladorController.ts
import { Request, Response, NextFunction } from 'express';
import { VigiladorService } from '../services/vigiladorService';
import { z } from 'zod';
import type { SubmitRegistroData } from '../types/index';
import { ValidationError } from '../utils/errorHandler';
import logger from '../utils/logger'; // Logger Pino centralizado (structured logging 2026)

// Esquema Zod para validación estricta y normalizada
const SubmitSchema = z.object({
  nombre: z.string().min(1).trim(),
  legajo: z.number().int().positive(),
  punto: z.number().int().min(1).max(10),
  novedades: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }), // ISO con offset normalizado
  geo: z.object({
    lat: z.number().nullable(),
    long: z.number().nullable(),
  }).optional(),
});

export class VigiladorController {
  /**
   * Maneja el envío de un registro de escaneo.
   * Valida datos, procesa con el servicio y responde.
   * Logging estructurado Pino-compliant (objeto primero, mensaje segundo).
   */
  static async submit(req: Request, res: Response, next: NextFunction) {
    // ← Orden correcto Pino: contexto primero, mensaje segundo
    logger.info({ body: req.body }, '📥 Nueva request a /api/submit');

    try {
      const parseResult = SubmitSchema.safeParse(req.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        const errMsg = `Datos inválidos: ${firstIssue.path.join('.')} - ${firstIssue.message}`;
        
        // ← Contexto estructurado primero
        logger.warn({ issues: parseResult.error.issues }, '⚠️ Validación fallida');
        throw new ValidationError(errMsg);
      }

      const data = parseResult.data as SubmitRegistroData;
      logger.debug({ data }, '✅ Datos validados');

      const result = await VigiladorService.procesarEscaneo(data);
      logger.info({ result }, '✅ Procesado exitoso');

      res.json(result);
    } catch (err: unknown) {
      const errorContext = {
        message: (err as Error).message,
        stack: (err as Error).stack,
        body: req.body,
      };
      logger.error(errorContext, '❌ Error en submit');
      next(err);
    }
  }

  static async getEstado(req: Request, res: Response, next: NextFunction) {
    logger.info({ legajo: req.params.legajo, ip: req.ip }, '📥 Request a /api/estado/:legajo'); // Contexto + IP para security logs

    try {
      const legajo = parseInt(req.params.legajo, 10);
      if (isNaN(legajo) || legajo <= 0) {
        logger.warn({ param: req.params.legajo }, '⚠️ Legajo no numérico o inválido');
        throw new ValidationError('Legajo inválido: debe ser un entero positivo');
      }

      const estado = await VigiladorService.getEstado(legajo);
      logger.debug({ legajo, progreso: estado.progreso }, '✅ Estado encontrado y normalizado');

      res.json(estado);
    } catch (err: unknown) {
      const errorContext = {
        message: (err as Error).message,
        stack: (err as Error).stack,
        params: req.params,
        ip: req.ip, // Extra context para forensic
      };
      logger.error(errorContext, '❌ Error en getEstado');
      next(err);
    }
  }
} 