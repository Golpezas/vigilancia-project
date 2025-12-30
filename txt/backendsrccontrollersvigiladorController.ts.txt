// src/controllers/vigiladorController.ts
import { Request, Response } from 'express';
import { VigiladorService } from '../services/vigiladorService'; // ← .js
import { z } from 'zod';
import type { SubmitRegistroData } from '../types/index'; // ← .js
import { ValidationError } from '../utils/errorHandler'; // ← .js

// ... resto igual

const SubmitSchema = z.object({
  nombre: z.string().min(1).trim(),
  legajo: z.number().int().positive(),
  punto: z.number().int().min(1).max(10),
  novedades: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }), // ← Corrección: datetime con offset para ISO
  geo: z.object({
    lat: z.number().nullable(),
    long: z.number().nullable(),
  }).optional(),
});

export class VigiladorController {
  static async submit(req: Request, res: Response) {
    const parseResult = SubmitSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      throw new ValidationError(`Datos inválidos: ${firstIssue.path.join('.')} - ${firstIssue.message}`);
    }

    const data = parseResult.data as SubmitRegistroData; // ← Tipado seguro
    const result = await VigiladorService.procesarEscaneo(data);

    res.json(result);
  }

  static async getEstado(req: Request, res: Response) {
    const legajo = parseInt(req.params.legajo, 10);
    if (isNaN(legajo)) {
      throw new ValidationError('Legajo inválido');
    }

    const estado = await VigiladorService.getEstado(legajo);
    if (!estado) {
      return res.status(404).json({ error: 'Vigilador no encontrado' });
    }

    res.json(estado);
  }
}