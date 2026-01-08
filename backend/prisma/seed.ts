// prisma/seed.ts
// Seed idempotente avanzado multi-servicio - Best practices 2026
// Crea catálogo global de puntos + múltiples servicios con asignaciones personalizadas
// Logging estructurado, upsert completo, normalización de nombres

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Catálogo maestro de puntos disponibles (global, reutilizable entre servicios)
const catalogoPuntos = [
  'Entrada Principal Norte', // id 1
  'Sector Producción Norte', // 2
  'Depósito Norte', // 3
  'Salida Emergencia Sur', // 4
  'Oficinas Sur', // 5
  'Patio Trasero Sur', // 6
  'Sector Logística Oeste', // 7
  'Sala de Servidores Oeste', // 8
];

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
  // Elimina "Default" si no lo necesitas, o hazlo único
];

async function main() {
  console.log('🌱 Iniciando seeding multi-servicio avanzado...');

  // 1. Crear catálogo global de puntos (idempotente)
  const puntosCreados = new Map<string, { id: number; nombre: string }>();
  for (const nombre of catalogoPuntos) {
    const punto = await prisma.punto.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    puntosCreados.set(nombre, punto);
    console.log(`✅ Punto global "${punto.nombre}" (id: ${punto.id}) sincronizado`);
  }

  // 2. Crear servicios y asignar puntos personalizados
  let totalAsignaciones = 0;
  for (const config of serviciosConfig) {
    const servicio = await prisma.servicio.upsert({
      where: { nombre: config.nombre },
      update: {},
      create: { nombre: config.nombre },
    });
    console.log(`✅ Servicio "${servicio.nombre}" (id: ${servicio.id}) sincronizado`);

    for (const nombrePunto of config.puntosAsignados) {
      const punto = puntosCreados.get(nombrePunto);
      if (!punto) {
        console.warn(`⚠️ Punto "${nombrePunto}" no encontrado en catálogo`);
        continue;
      }

      await prisma.servicioPunto.upsert({
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
    }
    console.log(`   ↳ ${config.puntosAsignados.length} puntos asignados a "${servicio.nombre}"`);
  }

  console.log(`\n🎉 Seeding completado exitosamente`);
  console.log(`   Puntos globales: ${catalogoPuntos.length}`);
  console.log(`   Servicios creados: ${serviciosConfig.length}`);
  console.log(`   Total asignaciones: ${totalAsignaciones}`);
}

main()
  .catch((e) => {
    console.error('❌ Error crítico en seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexión cerrada');
  });