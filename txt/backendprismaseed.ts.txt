// prisma/seed.ts
// Seed idempotente avanzado multi-servicio - Best practices 2026
// Crea catálogo global de puntos + múltiples servicios con asignaciones personalizadas
// Logging estructurado, upsert completo, normalización de nombres

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Catálogo maestro de puntos disponibles (global, reutilizable entre servicios)
const catalogoPuntos = [
  'Entrada Principal',
  'Sector Producción',
  'Depósito',
  'Salida Emergencia',
  'Oficinas',
  'Patio Trasero',
  'Sector Logística',
  'Sala de Servidores',
];

// Configuración de servicios de ejemplo con sus puntos asignados
const serviciosConfig = [
  {
    nombre: 'Default',
    puntosAsignados: [
      'Entrada Principal',
      'Sector Producción',
      'Depósito',
      'Salida Emergencia',
      'Oficinas',
      'Patio Trasero',
    ],
  },
  {
    nombre: 'Cliente Norte',
    puntosAsignados: [
      'Entrada Principal',
      'Depósito',
      'Patio Trasero',
      'Sala de Servidores',
    ],
  },
  {
    nombre: 'Cliente Sur',
    puntosAsignados: [
      'Entrada Principal',
      'Sector Producción',
      'Salida Emergencia',
      'Sector Logística',
    ],
  },
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