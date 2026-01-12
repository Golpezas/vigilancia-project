// src/types/index.ts
// Tipos centrales del dominio - Mejores prácticas: centralizados y reutilizables

export interface GeoLocation {
  lat: number | null;
  long: number | null;
}

export interface SubmitRegistroData {
  nombre: string;
  legajo: number;
  punto: number;          // 1 a 10
  novedades?: string;
  timestamp: string;      // ISO string
  geo?: GeoLocation;
}

export interface VigiladorEstado {
  id: string;
  nombre: string;
  legajo: number;
  ultimoPunto: number;
  rondaActiva: boolean;
}

export interface VigiladorEstadoExtendido extends VigiladorEstado {
  progreso: number;
  servicioNombre: string;
  ultimoTimestamp: string | null;
}