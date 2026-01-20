// frontend/src/db/offlineDb.ts
// Base de datos local IndexedDB para registros offline - Mejores prácticas 2026: Type-safety estricta, índices para queries rápidas, versión controlada

import Dexie from 'dexie';
import type { Table } from 'dexie'; // Type-only import para verbatimModuleSyntax
import type { SubmitRegistroData } from '../types/index'; // Mantenemos solo lo necesario

/**
 * Interfaz extendida para registros offline: añade UUID para idempotencia y flag synced.
 * Normalización: timestamp siempre ISO, geo opcional.
 */
export interface RegistroOffline extends SubmitRegistroData {
  uuid: string;         // UUID único generado localmente (idempotente en backend)
  createdAt: string;    // ISO timestamp de creación local
  synced: boolean;      // false = pendiente para sync
}

/**
 * Clase DB singleton: encapsula IndexedDB con Dexie.
 * - Versión 1: esquema inicial con índices para filtros rápidos (e.g., por synced).
 * - Mejores prácticas: Auto-abre conexión, manejo de errores silencioso para offline.
 */
class OfflineDb extends Dexie {
  registros!: Table<RegistroOffline>;

  constructor() {
    super('VigilanciaDB'); // Nombre único para la DB
    this.version(1).stores({
      registros: 'uuid, synced', // Índices: uuid primario, synced para queries pendientes
    });
  }
}

export const db = new OfflineDb();