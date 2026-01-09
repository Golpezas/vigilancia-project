"use strict";
// backend/src/utils/dateUtils.ts
// Util centralizado para normalización de fechas
// Mejor práctica 2026: Conversión UTC → Zona local en backend (fuente única de verdad)
// Zona: America/Argentina/Buenos_Aires (maneja horario de verano automáticamente)
Object.defineProperty(exports, "__esModule", { value: true });
exports.toArgentinaTime = toArgentinaTime;
exports.toArgentinaDate = toArgentinaDate;
const date_fns_tz_1 = require("date-fns-tz");
const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires';
const FORMAT_FECHA_HORA = 'dd/MM/yyyy HH:mm:ss';
const FORMAT_FECHA = 'dd/MM/yyyy';
/**
 * Convierte Date (UTC de DB) a string en hora Argentina
 * @param date Date o string ISO desde DB
 * @param formatStr Formato deseado (default fecha + hora)
 * @returns String formateado en zona local
 */
function toArgentinaTime(date, formatStr = FORMAT_FECHA_HORA) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return (0, date_fns_tz_1.formatInTimeZone)(dateObj, TIMEZONE_ARGENTINA, formatStr);
}
/**
 * Formato solo fecha (útil para reportes)
 */
function toArgentinaDate(date) {
    return toArgentinaTime(date, FORMAT_FECHA);
}
