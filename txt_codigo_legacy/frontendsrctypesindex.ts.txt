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
}

export interface ApiResponse {
  success?: boolean;
  mensaje?: string;
  error?: string;
}