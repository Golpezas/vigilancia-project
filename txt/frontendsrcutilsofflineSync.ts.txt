// frontend/src/utils/offlineSync.ts
// Actualización para OfflineSync.ts - Agrega Zod para validación response
// (Mejora robustez, previene crashes si backend cambia, logging mejorado)
import api from '../services/api';
import { db } from '../db/offlineDb';
import { isAxiosError } from 'axios';
import { z } from 'zod'; // ← Agrega este import si no está

// Schema Zod para validar response backend (best practice: type-safety runtime)
const SyncResponseSchema = z.object({
  success: z.boolean(),
  syncedUuids: z.array(z.string()).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Sincroniza todos los registros pendientes con el backend.
 * - Batch: envía múltiples en una llamada.
 * - Idempotente: backend maneja duplicados via UUID.
 * - No borra locales hasta confirmación.
 * - Validación Zod para response (segura).
 * @returns Promise<void> - Resuelve siempre (errores loggeados, no thrown para UX suave)
 */
export const syncPendingRegistros = async (): Promise<void> => {
  try {
    const pendientes = await db.registros.where('synced').equals(0).toArray();
    if (pendientes.length === 0) return;

    console.log(`[SYNC] Enviando ${pendientes.length} registros pendientes...`);

    const payload = pendientes.map(reg => ({
      uuid: reg.uuid,
      nombre: reg.nombre,
      legajo: reg.legajo,
      punto: reg.punto,
      novedades: reg.novedades,
      timestamp: reg.timestamp,
      geo: reg.geo,
    }));

    // Endpoint correcto
    const response = await api.post('/submit-batch', { registros: payload });

    // Validación Zod
    const validated = SyncResponseSchema.safeParse(response.data);
    if (!validated.success) {
      console.warn('[SYNC VALIDATION ERROR]', validated.error.issues);
      throw new Error('Respuesta inválida del backend');
    }

    if (validated.data.success) {
      const syncedUuids: string[] = validated.data.syncedUuids || [];
      await db.transaction('rw', db.registros, async () => {
        for (const uuid of syncedUuids) {
          await db.registros.where('uuid').equals(uuid).modify({ synced: 1 });
        }
      });
      console.log(`[SYNC] ${syncedUuids.length} registros sincronizados exitosamente`);
    } else {
      throw new Error(validated.data.error || 'Sync fallido sin error especificado');
    }
  } catch (err) {
    const errorDetails = isAxiosError(err) 
      ? { status: err.response?.status, message: err.response?.data?.error || err.message }
      : { message: (err as Error).message };
    console.warn('[SYNC ERROR] Fallo temporal al sincronizar:', errorDetails);
    
    // Retry simple: 1 intento extra después de 5s (evita bucles)
    setTimeout(syncPendingRegistros, 5000);
  }
};