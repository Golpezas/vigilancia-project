// prisma/seed.ts
// Seed idempotente multi-servicio - Versión estable 2026 con reset sequence dev-only
// Usa $transaction con array de promesas + timeout infinito (ideal para seeds)
// Logging Pino estructurado, normalización nombres, idempotencia total
// NUEVO: Reset sequence para IDs desde 1 (solo dev - escalable y seguro)

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
  logger.info({}, '🌱 Iniciando seeding idempotente multi-servicio (con reset sequence dev-only)');

  // Transacción con timeout alto y operaciones secuenciales
  await prisma.$transaction(async (tx) => {
    logger.debug({}, '🧹 Iniciando cleanup total...');

    // 1. Cleanup en orden inverso (referencias primero)
    await tx.registro.deleteMany({});
    await tx.servicioPunto.deleteMany({});
    await tx.vigilador.deleteMany({});
    await tx.servicio.deleteMany({});
    await tx.punto.deleteMany({});

    logger.info({}, '✅ Base de datos limpiada completamente');

    // 2. NUEVO: Reset sequences para autoincrements (solo en development - best practice escalable)
    if (process.env.NODE_ENV === 'development') {
      logger.debug({}, '🔄 Reseteando sequences para IDs desde 1 (dev-only)...');
      // Reset sequence para tabla 'punto' (ajusta si hay más autoincrements, e.g., otras tablas)
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE punto_id_seq RESTART WITH 1;`);
      // Si hay más: e.g., await prisma.$executeRawUnsafe(`ALTER SEQUENCE otra_tabla_id_seq RESTART WITH 1;`);
      logger.info({}, '✅ Sequences reseteadas exitosamente (IDs comenzarán en 1)');
    } else {
      logger.warn({}, '⚠️ Skip reset sequences en non-dev env (seguridad prod)');
    }

    // 3. Crear puntos (upsert por nombre unique) - Ahora IDs desde 1 en dev
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

    // 4. Crear servicios y asignar puntos
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
    timeout: 60000, // 60s - suficiente para raw queries
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