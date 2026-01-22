// src/App.tsx
import { useState, useEffect } from 'react';
import { QRScanner } from './components/QRScanner';
import { RegistroForm } from './components/RegistroForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import { db } from './db/offlineDb'; // Asegúrate de importar db
import api from './services/api';

function App() {
  const [punto, setPunto] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(!!localStorage.getItem('adminToken'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncLoading, setSyncLoading] = useState(false);

  // Cargar pendientes reactivamente
  const loadPendingCount = async () => {
    try {
      const count = await db.registros.where('synced').equals(0).count();
      setPendingCount(count);
      console.log('[PENDIENTES] Conteo actual:', count);
    } catch (err) {
      console.error('[PENDIENTES ERROR]', err);
      setPendingCount(0);
    }
  };

  useEffect(() => {
    loadPendingCount();

    // Recargar al volver a la pestaña (focus)
    window.addEventListener('focus', loadPendingCount);
    // También al online (reconexión)
    window.addEventListener('online', loadPendingCount);

    return () => {
      window.removeEventListener('focus', loadPendingCount);
      window.removeEventListener('online', loadPendingCount);
    };
  }, []);

  const handleSyncNow = async () => {
    if (pendingCount === 0) return;

    setSyncLoading(true);
    setError(null);

    try {
      const pendientes = await db.registros.where('synced').equals(0).toArray();
      if (pendientes.length === 0) {
        setPendingCount(0);
        return;
      }

      const payload = pendientes.map(reg => ({
        uuid: reg.uuid,
        nombre: reg.nombre,
        legajo: reg.legajo,
        punto: reg.punto,
        novedades: reg.novedades,
        timestamp: reg.timestamp,
        geo: reg.geo,
      }));

      console.log('[SYNC MANUAL] Enviando', pendientes.length, 'registros');

      const response = await api.post('/vigilador/submit-batch', { registros: payload });

      if (response.data.success) {
        const syncedUuids = response.data.syncedUuids || pendientes.map(r => r.uuid);
        await db.registros.where('uuid').anyOf(syncedUuids).modify({ synced: 1 });
        setPendingCount(0);
        setMensaje('Sincronización manual exitosa');
      } else {
        throw new Error(response.data.message || 'Error en respuesta');
      }
    } catch (err: unknown) {
      console.error('[SYNC MANUAL ERROR]', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al sincronizar manualmente. Intenta más tarde.';
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(
        axiosError?.response?.data?.error ||
        errorMessage ||
        'Error al sincronizar manualmente. Intenta más tarde.'
      );
    } finally {
      setSyncLoading(false);
      // Recargar conteo por si acaso
      loadPendingCount();
    }
  };

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);
    setError(null);
    setMensaje(null);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
    setMensaje('Has vuelto al modo Vigilador');
    setError(null);
  };

  const handleAdminBack = () => {
    setIsAdminMode(false);
    setError(null);
    setMensaje(null);
  };

  const handleScan = (p: number) => setPunto(p);

  const handleSuccess = (msg: string) => {
    setMensaje(msg);
    setPunto(null);
    setError(null);
    loadPendingCount(); // Recargar después de éxito
  };

  const handleError = (err: string) => setError(err);

  const handleBack = () => setPunto(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Control de Rondas QR</h1>

        {!isAdminMode && (
          <button
            onClick={() => setIsAdminMode(true)}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg mb-8 font-medium transition"
          >
            Ingresar como Administrador
          </button>
        )}

        {pendingCount > 0 && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-3 z-50">
            <span>Pendientes: {pendingCount}</span>
            <button
              onClick={handleSyncNow}
              disabled={syncLoading}
              className={`bg-white text-yellow-600 px-4 py-1 rounded-md font-medium hover:bg-gray-100 transition ${
                syncLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {syncLoading ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
          </div>
        )}

        {mensaje && (
          <div className="mb-6 p-4 bg-green-800 rounded-lg text-center">{mensaje}</div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-800 rounded-lg text-center">{error}</div>
        )}

        {isAdminMode ? (
          token ? (
            <AdminPanel token={token} onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin onSuccess={handleAdminLogin} onError={handleError} onBack={handleAdminBack} />
          )
        ) : !punto ? (
          <QRScanner onScan={handleScan} onError={handleError} />
        ) : (
          <RegistroForm punto={punto} onSuccess={handleSuccess} onError={handleError} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}

export default App;