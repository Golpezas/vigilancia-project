// scripts/generate-qrs-multi.ts
// Generador inteligente de QR por servicio - Multi-cliente 2026
// Mejores prácticas: Lee desde DB (Prisma), carpetas por servicio, filenames descriptivos
// Type-safety total, logging claro, idempotente, reutilizable

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = 'https://vigilancia-project.vercel.app'; // ← Cambia si usas otro dominio en prod
const ROOT_OUTPUT_DIR = path.join(process.cwd(), 'qrs-multi');

const qrOptions = {
  width: 512,
  margin: 2,
  color: {
    dark: '#1e40af',
    light: '#ffffff',
  },
};

async function main() {
  console.log('🚀 Iniciando generación de QR multi-servicio');
  console.log(`📱 URL base: ${BASE_URL}`);
  console.log(`📁 Carpeta raíz: ${path.resolve(ROOT_OUTPUT_DIR)}\n`);

  // Obtener todos los servicios con sus puntos ordenados
  const servicios = await prisma.servicio.findMany({
    include: {
      puntos: {
        include: { punto: true },
        orderBy: { punto: { id: 'asc' } },
      },
    },
  }) as Array<{ id: string; nombre: string; puntos: Array<{ punto: { id: string; nombre: string } | null }> }>;

  if (servicios.length === 0) {
    console.warn('⚠️ No hay servicios en la base de datos');
    return;
  }

  let totalGenerated = 0;

  for (const servicio of servicios) {
    const serviceDirName = servicio.nombre.replace(/[^a-zA-Z0-9]/g, '_');
    const serviceOutputDir = path.join(ROOT_OUTPUT_DIR, serviceDirName);

    if (!fs.existsSync(serviceOutputDir)) {
      fs.mkdirSync(serviceOutputDir, { recursive: true });
    }

    // Validación y filtrado de puntos válidos: Mapea a punto, filtra nulos y elimina duplicados por ID (best practice: data normalization early)
    // Usa Set para filtrado eficiente de duplicados (O(n) time, mejor que findIndex en arrays grandes)
    const puntosMap = new Map(servicio.puntos.map(sp => [sp.punto?.id, sp.punto]));
    const puntosValidos = Array.from(puntosMap.values()).filter(p => p != null); // Filtra undefined/null

    console.log(`📂 Generando QR para servicio: "${servicio.nombre}" (${puntosValidos.length} puntos válidos)`);

    if (puntosValidos.length === 0) {
      console.warn(`⚠️ Servicio "${servicio.nombre}" no tiene puntos asignados - saltando`);
      continue;
    }

    for (const punto of puntosValidos) {
      const url = `${BASE_URL}/punto/${punto.id}`; // Formato moderno y limpio (sin query params para IDs)

      const safePuntoName = punto.nombre.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${punto.id.toString().padStart(2, '0')}_${safePuntoName}.png`;
      const filePath = path.join(serviceOutputDir, fileName);

      try {
        await QRCode.toFile(filePath, url, qrOptions);
        console.log(`   ✅ ${fileName} → ${url}`);
        totalGenerated++;
      } catch (err) {
        console.error(`   ❌ Error en punto ${punto.id}:`, err);
      }
    }
    console.log('');
  }

  console.log(`🎉 ¡Generación completada!`);
  console.log(`   Total QR generados: ${totalGenerated}`);
  console.log(`   Ubicación: ${path.resolve(ROOT_OUTPUT_DIR)}`);
  console.log(`🖨️  Recomendación: Imprime en 10x10 cm con buena resolución`);
}

main()
  .catch((e) => {
    console.error('❌ Error crítico:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexión Prisma cerrada');
  });