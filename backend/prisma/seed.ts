// prisma/seed.ts
// Seed idempotente para servicios y puntos de control
// Best practice 2026: upsert para idempotencia, logging estructurado, orden lógico de creación
// Ejecutar con: npx prisma db seed
// Permite multi-servicio futuro: servicio por defecto como base para todos los vigiladores

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Puntos de control del servicio actual (agregá/editá/elimina según cliente)
const puntos = [
  { nombre: 'Entrada Principal' },
  { nombre: 'Sector Producción' },
  { nombre: 'Depósito' },
  { nombre: 'Salida Emergencia' },
  { nombre: 'Oficinas' },
  { nombre: 'Patio Trasero' },
  // El orden no importa: Prisma asigna id autoincremental automáticamente
];

async function main() {
  console.log('🌱 Iniciando seeding de servicio y puntos de control...');

  // 1. Crear servicio por defecto (idempotente)
  const servicioDefault = await prisma.servicio.upsert({
    where: { nombre: 'Default' },        // Búsqueda por nombre único
    update: {},                          // No actualizar si existe
    create: {
      nombre: 'Default',                 // Nombre del servicio inicial
    },
  });
  console.log(`✅ Servicio "${servicioDefault.nombre}" (id: ${servicioDefault.id}) sincronizado`);

  // 2. Sincronizar puntos de control (idempotente - compatible con tu código original)
  for (const punto of puntos) {
    const result = await prisma.punto.upsert({
      where: { nombre: punto.nombre },
      update: {},                        // No actualiza si ya existe
      create: punto,
    });
    console.log(`✅ Punto "${result.nombre}" (id: ${result.id}) sincronizado`);
  }

  console.log('🎉 Seeding completado exitosamente');
}

// Manejo robusto de errores y desconexión garantizada
main()
  .catch((e) => {
    console.error('❌ Error crítico en seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexión a base de datos cerrada');
  });