// src/utils/envUtils.ts
import { z } from 'zod';
import logger from './logger';

const EnvSchema = z.object({
  JWT_SECRET: z.string().min(48),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  // ... otras variables
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error({ issues: parsed.error.issues }, 'Variables de entorno inválidas');
  throw new Error('Configuración de entorno inválida');
}

export const env = parsed.data; // ← Solo exportamos el resultado validado