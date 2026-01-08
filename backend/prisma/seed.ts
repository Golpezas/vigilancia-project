// prisma/seed.ts
// Seed idempotente avanzado multi-servicio - Best practices 2026
// Limpieza total antes de insertar (dev-safe), transaccional, logging Pino-compliant
// Normalización: Nombres únicos con sufijo servicio para evitar confusión

import { PrismaClient } from '@prisma/client';
import logger from '../src/utils/logger'; // ← Importa logger Pino para structured logs

const prisma = new PrismaClient();

// Catálogo maestro de puntos disponibles (global, reutilizable entre servicios)
// Nombres normalizados con sufijo para uniqueness y claridad
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

// Configuración de servicios de ejemplo con sus puntos asignados (exclusivos, no compartidos)
const serviciosConfig = [
  {
    nombre: 'Cliente Norte',
    puntosAsignados: [
      'Entrada Principal Norte',
      'Sector Producción Norte',
      'Depósito Norte',
    ],
  },
  {
    nombre: 'Cliente Sur',
    puntosAsignados: [
      'Salida Emergencia Sur',
      'Oficinas Sur',
      'Patio Trasero Sur',
    ],
  },
  {
    nombre: 'Cliente Oeste',
    puntosAsignados: [
      'Sector Logística Oeste',
      'Sala de Servidores Oeste',
    ],
  },
  // Agrega 'Default' si lo necesitas, con puntos exclusivos
];

async function main() {
  logger.info({}, '🌱 Iniciando seeding idempotente multi-servicio...');

  // Transacción atómica: Todo o nada (best practice para consistency)
  await prisma.$transaction(async (tx) => {
    // 1. Cleanup total (orden inverso a FK para evitar violations)
    // Primero: Referencias many-to-many y dependientes
    logger.debug({}, '🧹 Limpiando referencias...');
    await tx.servicioPunto.deleteMany({});
    await tx.registro.deleteMany({});

    // Luego: Tablas principales (vigiladores, servicios, puntos)
    await tx.vigilador.deleteMany({});
    await tx.servicio.deleteMany({});
    await tx.punto.deleteMany({});

    logger.info({}, '✅ DB limpiada exitosamente');

    // 2. Crear catálogo global de puntos (idempotente con upsert por nombre unique)
    const puntosCreados = new Map<string, { id: number; nombre: string }>();
    let totalPuntos = 0;
    for (const nombre of catalogoPuntos) {
      const punto = await tx.punto.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      });
      puntosCreados.set(nombre, punto);
      totalPuntos++;
      logger.debug({ id: punto.id, nombre }, '📍 Punto creado/upserted');
    }

    // 3. Crear servicios y asignar puntos (exclusivos)
    let totalAsignaciones = 0;
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
          logger.warn({ nombrePunto }, '⚠️ Punto no encontrado en catálogo - saltando');
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
        totalAsignaciones++;
        logger.debug({ servicio: servicio.nombre, punto: punto.nombre }, '🔗 Asignación creada');
      }
    }

    logger.info({
      totalPuntos,
      totalServicios: serviciosConfig.length,
      totalAsignaciones,
    }, '🎉 Seeding completado en transacción');
  });

  logger.info({}, '🔄 Recomendación: Regenera QR con npm run generate:qrs:multi');
}

main()
  .catch((e) => {
    logger.error({ error: e.message, stack: e.stack }, '❌ Error crítico en seeding');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    logger.debug({}, '🔌 Conexión Prisma cerrada');
  });