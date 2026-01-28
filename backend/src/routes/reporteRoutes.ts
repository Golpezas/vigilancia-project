// src/routes/reporteRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { ReporteService } from '../services/reporteService';
import { requireAuth } from '../middlewares/authMiddleware';
import { z } from 'zod';
import logger from '../utils/logger';
import { prisma } from '../repositories/vigiladorRepository';

const router = Router();

// Schema Zod con transformación directa a Date (ya lo tenías bien)
const ReporteQuerySchema = z.object({
  servicioId: z.string().uuid({ message: 'servicioId debe ser UUID válido' }),
  fechaDesde: z.string()
    .datetime({ offset: true, message: 'fechaDesde debe ser ISO 8601 válido con offset' })
    .optional()
    .transform(val => val ? new Date(val) : undefined),
  fechaHasta: z.string()
    .datetime({ offset: true, message: 'fechaHasta debe ser ISO 8601 válido con offset' })
    .optional()
    .transform(val => val ? new Date(val) : undefined),
  vigiladorId: z.string().uuid().optional(),
});

router.get('/vigiladores', requireAuth(['ADMIN', 'CLIENT']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      servicioId: z.string().uuid({ message: 'servicioId debe ser UUID válido' }),
    });
    const { servicioId } = schema.parse(req.query);

    logger.info({ servicioId }, '📋 Fetching lista de vigiladores');

    const vigiladores = await prisma.vigilador.findMany({
      where: { servicioId },
      select: { id: true, nombre: true, legajo: true },
      orderBy: { nombre: 'asc' },
    });

    if (!vigiladores.length) {
      logger.info({ servicioId }, 'ℹ️ No vigiladores encontrados - retornando vacío');
      return res.json([]);
    }

    res.json(vigiladores);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      logger.warn({ issues: err.issues, rawQuery: req.query }, '⚠️ Falló validación Zod en vigiladores');
      return res.status(400).json({ error: 'Parámetros inválidos', details: err.errors });
    }
    next(err);
  }
});

router.get('/rondas', requireAuth(['ADMIN', 'CLIENT']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Validación + transformación automática a Date
    const filtros = ReporteQuerySchema.parse(req.query);

    // 2. Logging muy claro de lo que realmente llegó y se transformó
    logger.info(
      {
        rawQuery: req.query,
        parsedFiltros: {
          servicioId: filtros.servicioId,
          fechaDesde: filtros.fechaDesde?.toISOString(),
          fechaHasta: filtros.fechaHasta?.toISOString(),
          vigiladorId: filtros.vigiladorId,
        },
        userId: req.user?.id,
        role: req.user?.role,
      },
      '✅ Query validada y transformada a objetos Date'
    );

    // 3. Aquí ya tienes fechas como Date → puedes pasar directamente al service
    //    (el service ya debería manejarlas como UTC o convertir según necesite Prisma)
    const reportes = await ReporteService.getReportesRondas(filtros);

    logger.debug(
      { count: Object.keys(reportes).length },
      'Reporte generado exitosamente'
    );

    res.json(reportes);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      logger.warn(
        {
          issues: err.issues,
          rawQuery: req.query,
        },
        '⚠️ Falló validación Zod en reportes/rondas'
      );
      return res.status(400).json({
        error: 'Parámetros de fecha inválidos',
        details: err.errors,
      });
    }
    next(err);
  }
});

export default router;