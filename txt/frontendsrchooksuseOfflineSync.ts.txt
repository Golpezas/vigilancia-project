// frontend/src/hooks/useOfflineSync.ts
// Hook para auto-sync offline - Mejores prácticas: Eventos nativos, sync al mount, no polling

import { useEffect } from 'react';
import { syncPendingRegistros } from '../utils/offlineSync';

export const useOfflineSync = () => {
  useEffect(() => {
    // Sync inicial al montar app
    syncPendingRegistros();

    // Listener para reconexión
    const handleOnline = () => syncPendingRegistros();
    window.addEventListener('online', handleOnline);

    return () => window.removeEventListener('online', handleOnline);
  }, []);
};