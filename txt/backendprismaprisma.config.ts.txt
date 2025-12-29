// prisma.config.ts - Configuración Prisma 7 para desarrollo local con SQLite
import 'dotenv/config'; // Carga variables de .env automáticamente
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma', // Ruta al schema (relativa)
  migrations: {
    path: 'prisma/migrations', // Carpeta de migraciones
  },
  datasource: {
    url: env('DATABASE_URL'), // URL desde .env (para migrate y CLI)
  },
});