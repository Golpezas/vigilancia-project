"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toArgentinaTime = toArgentinaTime;
exports.toArgentinaDate = toArgentinaDate;
const date_fns_tz_1 = require("date-fns-tz");
const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires';
const FORMAT_FECHA_HORA = 'dd/MM/yyyy HH:mm:ss';
const FORMAT_FECHA = 'dd/MM/yyyy';
function toArgentinaTime(date, formatStr = FORMAT_FECHA_HORA) {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return (0, date_fns_tz_1.formatInTimeZone)(dateObj, TIMEZONE_ARGENTINA, formatStr);
}
function toArgentinaDate(date) {
    return toArgentinaTime(date, FORMAT_FECHA);
}
//# sourceMappingURL=dateUtils.js.map