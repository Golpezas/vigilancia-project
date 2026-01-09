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

router.get('/rondas', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validación runtime + inferencia de tipo
    const filtros = ReporteQuerySchema.parse(req.query);

    logger.info({ filtros, user: req.user }, '📥 Request a /api/reportes/rondas autenticada');

    const reportes = await ReporteService.getReportesRondas(filtros);
    res.json(reportes);
  } catch (err: unknown) {
    next(err); // Usa handler global de errores
  }
});

export default router;