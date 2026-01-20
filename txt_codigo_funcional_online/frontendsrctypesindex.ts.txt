// src/types/index.ts
export interface GeoLocation {
  lat: number | null;
  long: number | null;
}

export interface SubmitRegistroData {
  nombre: string;
  legajo: number;
  punto: number;
  novedades?: string;
  timestamp: string;
  geo?: GeoLocation;
  servicioId?: string; // Opcional por ahora, requerido en multi
}

export interface ApiResponse {
  success?: boolean;
  mensaje?: string;
  error?: string;
}

// src/types/index.ts (agrega al final)
// Tipos para reportes - Inferidos de backend (DRY: coincide con ReporteService output)
export interface RegistroReporte {
  punto: string;
  timestamp: string;
  geo: { lat: number; long: number } | null;
  novedades: string | null;
  alerta?: string; // Opcional para delays
}

export type RondasPorVigilador = Record<string, RegistroReporte[]>; // { vigiladorId: array de registros }