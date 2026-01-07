// frontend/src/utils/dateUtils.ts
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

export function formatArgentina(date: string | Date, formatStr = 'dd/MM/yyyy HH:mm:ss') {
  return formatInTimeZone(date, TIMEZONE, formatStr);
}