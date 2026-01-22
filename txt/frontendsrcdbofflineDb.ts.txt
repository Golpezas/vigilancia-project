// src/db/offlineDb.ts
import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { SubmitRegistroData } from '../types/index';

export interface RegistroOffline extends SubmitRegistroData {
  uuid: string;
  createdAt: string;
  synced: number; // 0 = pendiente, 1 = sincronizado
}

class OfflineDb extends Dexie {
  registros!: Table<RegistroOffline>;

  constructor() {
    super('VigilanciaDB');
    this.version(2) // ← ¡Subimos la versión a 2 para agregar índices!
      .stores({
        registros: 'uuid, synced, legajo, punto', // ← Agregamos índices para consultas frecuentes
      })
      .upgrade(() => {
        // Migración automática: si ya existía versión 1, Dexie la maneja
        console.log('DB migrada a v2 - índices agregados');
      });
  }
}

export const db = new OfflineDb();