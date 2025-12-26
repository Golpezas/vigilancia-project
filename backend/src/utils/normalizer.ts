// src/utils/normalizer.ts
// Funciones para normalización de datos - Aplicando mejores prácticas DRY y consistencia

import { z } from 'zod';

/**
 * Esquema Zod para geolocalización.
 * Permite valores nulos (cuando el usuario deniega permiso).
 */
export const GeoSchema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  long: z.number().min(-180).max(180).nullable().optional(),
});

/**
 * Normaliza y valida coordenadas geográficas.
 * @param geo Datos crudos de geolocalización
 * @returns Objeto normalizado o null si es inválido
 */
export function normalizeGeo(geo: unknown): { lat: number | null; long: number | null } | null {
  const result = GeoSchema.safeParse(geo);
  if (!result.success) {
    return null;
  }
  return {
    lat: result.data.lat ?? null,
    long: result.data.long ?? null,
  };
}

/**
 * Normaliza strings: elimina espacios y unifica formato.
 * @param str String de entrada
 * @returns String normalizado
 */
export function normalizeString(str: string | undefined | null): string {
  if (!str) return '';
  return str.trim().toLowerCase();
}

/**
 * Normaliza novedades (texto libre del vigilador)
 * @param novedades Texto ingresado
 * @returns Texto limpio y seguro
 */
export function normalizeNovedades(novedades: string | undefined | null): string {
  return normalizeString(novedades);
}