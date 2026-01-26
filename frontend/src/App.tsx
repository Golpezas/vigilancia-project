// src/App.tsx
import { useState, useEffect } from 'react';
import { QRScanner } from './components/QRScanner';
import { RegistroForm } from './components/RegistroForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import { db } from './db/offlineDb';
import api from './services/api';

// Recomendación: mueve esto a src/services/api.ts o un archivo constants.ts
const ENDPOINTS = {
  SUBMIT_BATCH: '/submit-batch',  // ← CORRECTO (sin /vigilador)
} as const;

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
      console.log('[PENDIENTES] Conteo actualizado:', count);
    } catch (err) {
      console.error('[PENDIENTES ERROR]', err);
      setPendingCount(0);
    }
  };

  useEffect(() => {
    loadPendingCount();

    window.addEventListener('focus', loadPendingCount);
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
    setMensaje(null);

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

      console.log('[SYNC MANUAL] Enviando batch de', pendientes.length, 'registros → endpoint:', ENDPOINTS.SUBMIT_BATCH);

      const response = await api.post(ENDPOINTS.SUBMIT_BATCH, { registros: payload });

      console.log('[SYNC MANUAL] Respuesta backend:', response.data);

      if (response.data.success) {
        const syncedUuids = response.data.syncedUuids || pendientes.map(r => r.uuid);
        await db.registros.where('uuid').anyOf(syncedUuids).modify({ synced: 1 });
        setPendingCount(0);
        setMensaje('Sincronización manual exitosa ✓');
      } else {
        throw new Error(response.data.message || response.data.error || 'Respuesta no exitosa');
      }
    } catch (err: unknown) {
      console.error('[SYNC MANUAL ERROR]', err);

      let errorMessage = 'Error al sincronizar. Intenta más tarde.';
      let isLogicalError = false;

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // Diferenciamos errores lógicos (400) de red/500
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
        const status = axiosErr.response?.status;
        const backendMsg = axiosErr.response?.data?.error || axiosErr.response?.data?.message;

        if (status === 400 && backendMsg) {
          // Error lógico (secuencia, validación, etc.)
          isLogicalError = true;
          errorMessage = backendMsg; // ej: "Debes escanear el punto 3 antes de 1..."
        } else if (status === 404) {
          errorMessage = 'Ruta no encontrada - verifica configuración del endpoint';
        } else if (status && status >= 500) {
          errorMessage = 'Error interno del servidor. Intenta más tarde.';
        }
      }

      setError(errorMessage);

      // Si fue error lógico, podemos limpiar pendientes fallidos (opcional)
      if (isLogicalError) {
        // Opcional: borrar los que fallaron por validación para no acumular
        // await db.registros.where('synced').equals(0).delete();
        // loadPendingCount();
      }
    } finally {
      setSyncLoading(false);
      loadPendingCount(); // Siempre recargamos conteo
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
    let displayMsg = msg;

    // Enriquecemos visualmente según contenido
    if (msg.includes('finalizada') || msg.includes('completada') || msg.includes('100%')) {
      displayMsg = `🎉 ${msg}\n\nPuedes iniciar una nueva ronda escaneando el primer punto.`;
    } else if (msg.includes('Siguiente esperado')) {
      displayMsg = `${msg}\n\nContinúa con el siguiente punto.`;
    }

    setMensaje(displayMsg);
    setPunto(null);
    setError(null);
    loadPendingCount();
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
          <div className="mb-6 p-4 bg-green-800 rounded-lg text-center whitespace-pre-line">
            {mensaje}
          </div>
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