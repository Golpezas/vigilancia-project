// prisma.config.ts  ← ¡Debe estar en la raíz del proyecto!
import 'dotenv/config';               // ← Carga .env automáticamente (muy importante)
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',     // Ruta relativa desde la raíz

  migrations: {
    path: 'prisma/migrations',
    // seed: 'ts-node prisma/seed.ts',  // Descomenta si usas seed con ts-node
    // O si usas tsx (mejor rendimiento): 'tsx prisma/seed.ts'
  },

  datasource: {
    url: env('DATABASE_URL'),         // ← ¡Aquí va la conexión! Usa env() para type-safety
    // Alternativa más segura si env() falla en algunos comandos:
    //url: process.env.DATABASE_URL ?? '',
  },
});
