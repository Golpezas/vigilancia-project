// scripts/generate-qrs.ts
// Generador configurable de QR para número variable de puntos
// Mejor práctica 2025: configuración externa, type-safety, reutilizable, documentación JSDoc

import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

// Carga configuración
const configPath = path.join(process.cwd(), 'qrs-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
  serviceName: string;
  numberOfPoints: number;
  baseUrl: string;
  outputDir: string;
  qrOptions: {
    width: number;
    margin: number;
    color: {
      dark: string;
      light: string;
    };
  };
};

const {
  serviceName,
  numberOfPoints,
  baseUrl,
  outputDir,
  qrOptions
} = config;

// Crea carpeta de salida
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Genera QR para cada punto
const points = Array.from({ length: numberOfPoints }, (_, i) => i + 1);

console.log(`🚀 Generando ${numberOfPoints} QR para "${serviceName}"`);
console.log(`📱 URL base: ${baseUrl}\n`);

(async () => {
  for (const punto of points) {
    const url = `${baseUrl}/punto/${punto}`;
    const fileName = `Punto_${punto.toString().padStart(2, '0')}_${serviceName.replace(/ /g, '_')}.png`;
    const filePath = path.join(outputDir, fileName);

    try {
      await QRCode.toFile(filePath, url, qrOptions);
      console.log(`✅ ${fileName} → ${url}`);
    } catch (err) {
      console.error(`❌ Error en Punto ${punto}:`, err);
    }
  }

  console.log(`\n🎉 ¡Generación completada!`);
  console.log(`📁 QR guardados en: ${path.resolve(outputDir)}`);
  console.log(`🖨️  Recomendación: Imprime en tamaño 10x10 cm para óptima lectura`);
})();