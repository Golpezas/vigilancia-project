// scripts/generate-qrs-multi.ts
// Generador inteligente de QR por servicio - Multi-cliente 2026
// Mejores prácticas: Prisma 7+ con adapter explícito, carga .env manual, type-safety total,
// normalización estricta de datos, logging claro, idempotente, reutilizable

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config'; // Carga automática de .env (necesario en scripts standalone)

// Inicialización segura de PrismaClient para scripts (Prisma 7+ requiere adapter explícito)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida en .env');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'https://vigilancia-project.vercel.app'; // Cambia si usas otro dominio en prod
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
  const serviciosCrudos = await prisma.servicio.findMany({
    include: {
      puntos: {
        include: { punto: true },
        orderBy: { punto: { id: 'asc' } },
      },
    },
  });

  // Normalizamos los IDs a string (estándar moderno para URLs y QR)
  const servicios = serviciosCrudos.map(servicio => ({
    id: servicio.id,
    nombre: servicio.nombre,
    puntos: servicio.puntos.map(asignacion => ({
      punto: asignacion.punto
        ? {
            id: asignacion.punto.id.toString(),
            nombre: asignacion.punto.nombre,
          }
        : null,
    })),
  }));

  if (servicios.length === 0) {
    console.warn('⚠️ No hay servicios en la base de datos');
    return;
  }

  let totalGenerated = 0;

  for (const servicio of servicios) {
    const serviceDirName = servicio.nombre.replace(/[^a-zA-Z0-9]/g, '_');
    const serviceOutputDir = path.join(ROOT_OUTPUT_DIR, serviceDirName);

    // Idempotente: crea carpeta si no existe
    if (!fs.existsSync(serviceOutputDir)) {
      fs.mkdirSync(serviceOutputDir, { recursive: true });
    }

    // Normalización y filtrado de puntos válidos (evita nulls y duplicados por ID)
    const puntosMap = new Map<string, { id: string; nombre: string } | null>(
      servicio.puntos.map(sp => [sp.punto?.id ?? '', sp.punto])
    );

    const puntosValidos = Array.from(puntosMap.values()).filter(
      (p): p is { id: string; nombre: string } => p !== null
    );

    console.log(`📂 Generando QR para servicio: "${servicio.nombre}" (${puntosValidos.length} puntos válidos)`);

    if (puntosValidos.length === 0) {
      console.warn(`⚠️ Servicio "${servicio.nombre}" no tiene puntos asignados - saltando`);
      continue;
    }

    for (const punto of puntosValidos) {
      const url = `${BASE_URL}/punto/${punto.id}`; // Formato limpio y moderno

      const safePuntoName = punto.nombre.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${punto.id.padStart(3, '0')}_${safePuntoName}.png`; // padStart 3 dígitos para orden
      const filePath = path.join(serviceOutputDir, fileName);

      try {
        await QRCode.toFile(filePath, url, qrOptions);
        console.log(`   ✅ ${fileName} → ${url}`);
        totalGenerated++;
      } catch (err) {
        console.error(`   ❌ Error generando QR para punto ${punto.id} (${punto.nombre}):`, err);
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
    console.error('❌ Error crítico durante generación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Conexión Prisma cerrada');
  });