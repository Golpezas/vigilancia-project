// src/components/QRScanner.tsx
import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner'; // ← type-only import (best practice)

interface QRScannerProps {
  onScan: (punto: number) => void;
  onError?: (error: string) => void;
}

/**
 * Componente de escaneo QR con soporte dual completo:
 * - Formato antiguo: ?punto=1
 * - Formato nuevo (recomendado): /punto/1
 * 
 * Mejores prácticas 2025 aplicadas:
 * - Tipado estricto y seguro (null/undefined handling)
 * - Parsing robusto con RegExp y fallbacks
 * - Validación centralizada y configurable
 * - Manejo de errores sin variables unused
 * - Código legible y documentado
 */
export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const MAX_PUNTOS = 20; // Centralizado: fácil de ajustar si ampliás puntos

  const handleScan = (results: IDetectedBarcode[]) => {
    if (results.length === 0) return;

    try {
      const rawValue = results[0].rawValue.trim();
      const url = new URL(rawValue);

      let puntoStr: string | null = null;

      // 1. Query param clásico (?punto=1) - compatibilidad con QR antiguos
      puntoStr = url.searchParams.get('punto');

      // 2. Ruta limpia nueva (/punto/1)
      if (!puntoStr) {
        const match = url.pathname.match(/^\/punto\/(\d+)$/i);
        if (match?.[1]) {
          puntoStr = match[1];
        }
      }

      // 3. Fallback flexible: último segmento numérico en pathname (ej: /1)
      if (!puntoStr) {
        const segments = url.pathname.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1];
        if (/^\d+$/.test(lastSegment)) {
          puntoStr = lastSegment;
        }
      }

      const punto = parseInt(puntoStr ?? '0', 10);

      if (Number.isNaN(punto) || punto < 1 || punto > MAX_PUNTOS) {
        onError?.(`Punto inválido: debe estar entre 1 y ${MAX_PUNTOS}`);
        return;
      }

      onScan(punto);
    } catch {
      // ← No declaramos variable err (evita unused-var)
      onError?.('QR no válido: debe contener una URL con formato correcto');
    }
  };

  const handleError = (error: unknown) => {
    const msg =
      error instanceof Error ? error.message : 'Error al acceder a la cámara';
    onError?.(msg);
  };

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold text-center mb-4">
        Escanee el código QR del punto
      </h2>
      <Scanner
        onScan={handleScan}
        onError={handleError}
        scanDelay={1000}
        components={{ finder: true }}
        styles={{
          container: { width: '100%' },
          video: { width: '100%' },
        }}
      />
    </div>
  );
};