// src/routes/reporteRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { ReporteService } from '../services/reporteService';
import { requireAuth } from '../middlewares/authMiddleware';
import { z } from 'zod';
import logger from '../utils/logger';

const router = Router();

// Schema Zod reutilizable (DRY con el de reporteService)
const ReporteQuerySchema = z.object({
  servicioId: z.string().uuid({ message: 'servicioId debe ser UUID válido' }),
  fechaDesde: z.string().datetime({ offset: true }).optional(),
  fechaHasta: z.string().datetime({ offset: true }).optional(),
  vigiladorId: z.string().uuid().optional(),
});

router.get('/rondas', requireAuth(['ADMIN', 'CLIENT']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filtros = ReporteQuerySchema.parse({
      ...req.query,
      servicioId: req.query.servicioId ?? req.user?.servicioId, // ← Fallback desde JWT para CLIENT
    });

    logger.info(
      {
        filtros,
        userId: req.user?.id,
        role: req.user?.role,
        ip: req.ip,
      },
      '📥 Reporte de rondas solicitado (autenticado)'
    );

    const reportes = await ReporteService.getReportesRondas(filtros);
    
    logger.debug({ count: Object.keys(reportes).length }, 'Reporte generado exitosamente');

    res.json(reportes);
    
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      logger.warn({ issues: err.issues }, '⚠️ Validación de query fallida en reportes/rondas');
      return res.status(400).json({ error: 'Parámetros inválidos', details: err.errors });
    }
    next(err);
  }
});

export default router;