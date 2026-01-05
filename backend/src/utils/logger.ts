// src/utils/logger.ts
// Logger centralizado con Pino v10+ - Estructurado, bajo overhead, type-safe nativo
// Best practice 2026: Transport condicional (JSON en prod, pretty en dev)
// Normalización: Timestamp ISO, levels dinámicos, sin @types extras

import pino from 'pino';

// Configuración base común
const baseConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // Menos verbose en prod
  timestamp: pino.stdTimeFunctions.isoTime, // Timestamp normalizado ISO (mejor para búsquedas)
};

// Transport condicional: Pretty solo en desarrollo (evita overhead en prod)
const transport = process.env.NODE_ENV !== 'production'
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', // Formato legible + ISO-like
        ignore: 'pid,hostname', // Limpia noise innecesario
        messageFormat: '{msg} [context: {reqId || "-"}]', // Opcional: agrega context si usas child loggers
      },
    })
  : undefined; // En prod: salida JSON cruda (ideal para Railway logs parsing)

const logger = pino({
  ...baseConfig,
  transport,
});

export default logger;