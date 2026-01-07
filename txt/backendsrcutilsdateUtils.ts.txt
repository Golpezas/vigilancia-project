// backend/src/utils/dateUtils.ts
// Util centralizado para normalización de fechas
// Mejor práctica 2026: Conversión UTC → Zona local en backend (fuente única de verdad)
// Zona: America/Argentina/Buenos_Aires (maneja horario de verano automáticamente)

import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires';
const FORMAT_FECHA_HORA = 'dd/MM/yyyy HH:mm:ss';
const FORMAT_FECHA = 'dd/MM/yyyy';

/**
 * Convierte Date (UTC de DB) a string en hora Argentina
 * @param date Date o string ISO desde DB
 * @param formatStr Formato deseado (default fecha + hora)
 * @returns String formateado en zona local
 */
export function toArgentinaTime(
  date: Date | string,
  formatStr: string = FORMAT_FECHA_HORA
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, TIMEZONE_ARGENTINA, formatStr);
}

/**
 * Formato solo fecha (útil para reportes)
 */
export function toArgentinaDate(date: Date | string): string {
  return toArgentinaTime(date, FORMAT_FECHA);
}