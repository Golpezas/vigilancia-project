// prisma/seed.ts
// Seed idempotente multi-servicio - Versión estable 2026
// Usa $transaction con array de promesas + timeout infinito (ideal para seeds)
// Logging Pino estructurado, normalización nombres, idempotencia total

import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger';

const prisma = new PrismaClient();

// Catálogo de puntos normalizados (nombres únicos con sufijo)
const catalogoPuntos = [
  'Entrada Principal Norte',
  'Sector Producción Norte',
  'Depósito Norte',
  'Salida Emergencia Sur',
  'Oficinas Sur',
  'Patio Trasero Sur',
  'Sector Logística Oeste',
  'Sala de Servidores Oeste',
];

// Servicios con asignaciones exclusivas (sin compartidos)
const serviciosConfig = [
  {
    nombre: 'Cliente Norte',
    puntosAsignados: ['Entrada Principal Norte', 'Sector Producción Norte', 'Depósito Norte'],
  },
  {
    nombre: 'Cliente Sur',
    puntosAsignados: ['Salida Emergencia Sur', 'Oficinas Sur', 'Patio Trasero Sur'],
  },
  {
    nombre: 'Cliente Oeste',
    puntosAsignados: ['Sector Logística Oeste', 'Sala de Servidores Oeste'],
  },
];

async function main() {
  logger.info({}, '🌱 Iniciando seeding idempotente multi-servicio (versión estable)');

  // Transacción con timeout infinito y operaciones secuenciales
  await prisma.$transaction(async (tx) => {
    logger.debug({}, '🧹 Iniciando cleanup total...');

    // 1. Cleanup en orden inverso (referencias primero)
    await tx.registro.deleteMany({});
    await tx.servicioPunto.deleteMany({});
    await tx.vigilador.deleteMany({});
    await tx.servicio.deleteMany({});
    await tx.punto.deleteMany({});

    logger.info({}, '✅ Base de datos limpiada completamente');

    // 2. Crear puntos (upsert por nombre unique)
    const puntosCreados = new Map<string, { id: number; nombre: string }>();

    for (const nombre of catalogoPuntos) {
      const punto = await tx.punto.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
      puntosCreados.set(nombre, punto);
      logger.debug({ id: punto.id, nombre }, '📍 Punto creado/upserted');
    }

    // 3. Crear servicios y asignar puntos
    for (const config of serviciosConfig) {
      const servicio = await tx.servicio.upsert({
        where: { nombre: config.nombre },
        update: {},
        create: { nombre: config.nombre },
      });
      logger.info({ id: servicio.id, nombre: servicio.nombre }, '🏢 Servicio creado/upserted');

      for (const nombrePunto of config.puntosAsignados) {
        const punto = puntosCreados.get(nombrePunto);
        if (!punto) {
          logger.warn({ nombrePunto }, '⚠️ Punto no encontrado - saltando asignación');
          continue;
        }

        await tx.servicioPunto.upsert({
          where: {
            servicioId_puntoId: {
              servicioId: servicio.id,
              puntoId: punto.id,
            },
          },
          update: {},
          create: {
            servicioId: servicio.id,
            puntoId: punto.id,
          },
        });
        logger.debug(
          { servicio: servicio.nombre, puntoId: punto.id, puntoNombre: punto.nombre },
          '🔗 Asignación punto-servicio creada'
        );
      }
    }

    logger.info(
      {
        totalPuntos: catalogoPuntos.length,
        totalServicios: serviciosConfig.length,
      },
      '🎉 Seeding completado exitosamente dentro de transacción estable'
    );
  }, {
    // ← CLAVE: Timeout personalizado (0 = infinito, recomendado para seeds)
    timeout: 60000, // 60 segundos (más que suficiente incluso en Railway)
    // Si quieres infinito: timeout: 0 (pero Prisma recomienda valor alto)
  });

  logger.info({}, '🔄 Recomendación: Ejecuta npm run generate:qrs:multi para QR actualizados');
}

main()
  .catch((e) => {
    logger.error(
      { error: e.message, stack: e.stack },
      '❌ Error crítico durante seeding - revisa conexión/latencia'
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    logger.debug({}, '🔌 Conexión Prisma cerrada');
  });