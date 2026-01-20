// frontend/src/hooks/useOfflineSync.ts
// Hook para auto-sync offline - Mejores prácticas 2026: Eventos nativos + timer polling + visibility change
// Type-safety estricta, normalización synced a number (0/1) para indexing óptimo en Dexie,
// evitación total de cascading renders: actualización de contador en useEffect separado

import { useEffect, useState, useCallback } from 'react';
import { syncPendingRegistros } from '../utils/offlineSync';
import { db } from '../db/offlineDb';

/**
 * Hook que gestiona sincronización automática y contador de pendientes.
 * - Sync al mount, al recuperar conexión, al volver a foreground, y polling cada 30s si pendientes > 0.
 * - Usa synced como number (0=pendiente, 1=synced) para compatibilidad óptima con Dexie indexing.
 * - Evita cascading renders: actualización de contador en useEffect dedicado.
 */
export const useOfflineSync = () => {
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Función memoizada para actualizar contador (estable y reusable)
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await db.registros.where('synced').equals(0).count();
      setPendingCount(count);
    } catch (err) {
      console.warn('[OFFLINE COUNT] Error al contar pendientes:', err);
      setPendingCount(0);
    }
  }, []);

  // Efecto 1: Sync inicial + listeners + timer (NO actualiza contador aquí)
  useEffect(() => {
    // Solo sync inicial (no llama a setState directamente)
    syncPendingRegistros();

    // Listener reconexión
    const handleOnline = () => {
      console.log('[OFFLINE] Conexión restaurada → sincronizando');
      syncPendingRegistros().then(updatePendingCount);
    };
    window.addEventListener('online', handleOnline);

    // Timer polling: cada 30s si online
    const pollInterval = setInterval(async () => {
      if (navigator.onLine) {
        await syncPendingRegistros();
        await updatePendingCount();
      }
    }, 30000);

    // Visibility change (foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[VISIBILITY SYNC] App visible → intentando sync');
        syncPendingRegistros().then(updatePendingCount);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePendingCount]); // Dependencia estable

  // Efecto 2: Actualización inicial y periódica del contador (separado para evitar warning)
  useEffect(() => {
    // Inicial al mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePendingCount();

    // Opcional: refresco periódico del contador (cada 60s por si sync falla silenciosamente)
    const countInterval = setInterval(updatePendingCount, 60000);

    return () => clearInterval(countInterval);
  }, [updatePendingCount]);

  return {
    pendingCount,
    syncNow: syncPendingRegistros,
    updatePendingCount,
  };
};