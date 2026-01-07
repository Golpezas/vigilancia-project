// prisma/seed.ts
// Seed idempotente para puntos de control - Ejecutar con npx prisma db seed
// Best practice 2025: uso de upsert, orden alfabético opcional, logging claro

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const puntos = [
  { nombre: 'Entrada Principal' },
  { nombre: 'Sector Producción' },
  { nombre: 'Depósito' },
  { nombre: 'Salida Emergencia' },
  { nombre: 'Oficinas' },
  { nombre: 'Patio Trasero' },
  // Agregá, editá o eliminá aquí los puntos reales de tu cliente
  // El orden no importa: Prisma asigna id autoincremental automáticamente
];

async function main() {
  console.log('🌱 Iniciando seeding de puntos de control...');

  for (const punto of puntos) {
    const result = await prisma.punto.upsert({
      where: { nombre: punto.nombre },
      update: {}, // No actualiza nada si ya existe (idempotente)
      create: punto,
    });
    console.log(`✅ Punto "${result.nombre}" (id: ${result.id}) sincronizado`);
  }

  console.log('🎉 Seeding completado exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error en seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });