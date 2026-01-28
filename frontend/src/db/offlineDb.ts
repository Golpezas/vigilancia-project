// src/db/offlineDb.ts
import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { SubmitRegistroData } from '../types/index';

export interface RegistroOffline extends SubmitRegistroData {
  uuid: string;
  createdAt: string;
  synced: number; // 0 = pendiente, 1 = sincronizado
  error?: string | null; // Nuevo: Para marcar errores en sync (e.g., 'Secuencia inválida')
}

class OfflineDb extends Dexie {
  registros!: Table<RegistroOffline>;

  constructor() {
    super('VigilanciaDB');
    this.version(3) // ← Subimos versión para agregar 'error'
      .stores({
        registros: 'uuid, synced, legajo, punto, error', // ← Índices optimizados para queries frecuentes (sync pendientes, por error)
      })
      .upgrade((tx) => {
        // Migración: Agregar error: null a existentes
        return tx.table('registros').toCollection().modify({ error: null });
      });
  }
}

export const db = new OfflineDb();