// prisma/seed.ts
// Seed idempotente para servicios, puntos y asignación de puntos por servicio
// Best practice 2026: upsert completo, logging estructurado, normalización multi-servicio

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const puntos = [
  { nombre: 'Entrada Principal' },
  { nombre: 'Sector Producción' },
  { nombre: 'Depósito' },
  { nombre: 'Salida Emergencia' },
  { nombre: 'Oficinas' },
  { nombre: 'Patio Trasero' },
];

async function main() {
  console.log('🌱 Iniciando seeding de servicio, puntos y asignación...');

  // 1. Servicio por defecto
  const servicioDefault = await prisma.servicio.upsert({
    where: { nombre: 'Default' },
    update: {},
    create: { nombre: 'Default' },
  });
  console.log(`✅ Servicio "${servicioDefault.nombre}" (id: ${servicioDefault.id}) sincronizado`);

  // 2. Puntos
  const puntosCreados = [];
  for (const punto of puntos) {
    const result = await prisma.punto.upsert({
      where: { nombre: punto.nombre },
      update: {},
      create: punto,
    });
    puntosCreados.push(result);
    console.log(`✅ Punto "${result.nombre}" (id: ${result.id}) sincronizado`);
  }

  // 3. Asignar todos los puntos al servicio Default (idempotente)
  for (const punto of puntosCreados) {
    await prisma.servicioPunto.upsert({
      where: {
        servicioId_puntoId: {
          servicioId: servicioDefault.id,
          puntoId: punto.id,
        },
      },
      update: {},
      create: {
        servicioId: servicioDefault.id,
        puntoId: punto.id,
      },
    });
  }
  console.log(`✅ Todos los ${puntosCreados.length} puntos asignados al servicio "Default"`);

  console.log('🎉 Seeding completado exitosamente');
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