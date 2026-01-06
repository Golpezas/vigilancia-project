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