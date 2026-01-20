// frontend/src/utils/offlineSync.ts
// Utilidad para sincronización offline - Mejores prácticas 2026: Idempotente, batch, retry silencioso, logging estructurado

import api from '../services/api';
import { db } from '../db/offlineDb';

/**
 * Sincroniza todos los registros pendientes con el backend.
 * - Batch: envía múltiples en una llamada.
 * - Idempotente: backend maneja duplicados via UUID.
 * - No borra locales hasta confirmación.
 * @returns Promise<void> - Resuelve siempre (errores loggeados, no thrown para UX suave)
 */
export const syncPendingRegistros = async (): Promise<void> => {
  try {
    const pendientes = await db.registros.where('synced').equals(0).toArray();
    if (pendientes.length === 0) return;

    console.log(`[SYNC] Enviando ${pendientes.length} registros pendientes...`);

    // Preparar payload normalizado
    const payload = pendientes.map(reg => ({
      uuid: reg.uuid,
      nombre: reg.nombre,
      legajo: reg.legajo,
      punto: reg.punto,
      novedades: reg.novedades,
      timestamp: reg.timestamp,
      geo: reg.geo,
    }));

    const response = await api.post('/vigilador/submit-batch', { registros: payload }); // Nuevo endpoint, ver backend

    // Marcar como synced (basado en respuesta del backend)
    const syncedUuids: string[] = response.data.syncedUuids || [];
    await db.transaction('rw', db.registros, async () => {
      for (const uuid of syncedUuids) {
        await db.registros.where('uuid').equals(uuid).modify({ synced: true });
      }
    });

    console.log(`[SYNC] ${syncedUuids.length} registros sincronizados exitosamente`);
  } catch (err) {
    console.warn('[SYNC ERROR] Fallo temporal al sincronizar:', err);
    // No throw: se reintentará automáticamente después
  }
};