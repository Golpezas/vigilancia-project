// frontend/src/hooks/useOfflineSync.ts
// Hook para auto-sync offline - Mejores prácticas 2026: Eventos nativos + timer polling + visibility change
// Type-safety estricta, evitación de cascading renders con useCallback + efectos separados

import { useEffect, useState, useCallback } from 'react';
import { syncPendingRegistros } from '../utils/offlineSync';
import { db } from '../db/offlineDb';

/**
 * Hook que gestiona sincronización automática y contador de pendientes.
 * - Sync al mount, al recuperar conexión, al volver a foreground, y polling cada 15-60s.
 * - Evita cascading renders: actualización de contador en efecto dedicado.
 * - Logging detallado para depuración.
 */
export const useOfflineSync = () => {
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Función memoizada para actualizar contador (estable)
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await db.registros.where('synced').equals(0).count();
      setPendingCount(count);
      console.log('[OFFLINE DEBUG] Contador actualizado:', count);
    } catch (err) {
      console.error('[OFFLINE COUNT ERROR]', err);
      setPendingCount(0);
    }
  }, []);

  // Efecto principal: sync inicial + listeners + timer
  useEffect(() => {
    console.log('[OFFLINE DEBUG] Hook montado - iniciando sync y conteo');

    // Sync y conteo iniciales
    syncPendingRegistros().then(updatePendingCount);

    // Listener reconexión
    const handleOnline = () => {
      console.log('[OFFLINE] Evento online detectado → sincronizando');
      syncPendingRegistros().then(updatePendingCount);
    };
    window.addEventListener('online', handleOnline);

    // Timer polling (15s dev, 60s prod)
    const pollInterval = setInterval(async () => {
      if (navigator.onLine) {
        console.log('[POLL SYNC] Verificando pendientes periódicamente');
        await syncPendingRegistros();
        await updatePendingCount();
      }
    }, import.meta.env.DEV ? 15000 : 60000);

    // Visibility change (foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('[VISIBILITY] App visible → sincronizando');
        syncPendingRegistros().then(updatePendingCount);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatePendingCount]);

  return {
    pendingCount,
    syncNow: syncPendingRegistros,
    updatePendingCount,
  };
};