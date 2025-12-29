// src/components/QRScanner.tsx
import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import type { IDetectedBarcode } from '@yudiel/react-qr-scanner';  // ← Import type-only

interface QRScannerProps {
  onScan: (punto: number) => void;
  onError?: (error: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, onError }) => {
  const handleScan = (results: IDetectedBarcode[]) => {
    if (results.length > 0) {
      try {
        const url = new URL(results[0].rawValue);
        const puntoParam = url.searchParams.get('punto');
        const punto = parseInt(puntoParam || '0', 10);
        if (punto >= 1 && punto <= 10) {
          onScan(punto);
        } else {
          onError?.('Punto inválido: debe estar entre 1 y 10');
        }
      } catch {
        onError?.('El código QR no contiene una URL válida');
      }
    }
  };

  const handleError = (error: unknown) => {
    const msg = error instanceof Error ? error.message : 'Error al acceder a la cámara';
    onError?.(msg);
  };

  return (
    <div className="w-full max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold text-center mb-4">Escanee el código QR del punto</h2>
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