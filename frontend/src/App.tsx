// src/App.tsx
// Orquestador principal con estado normalizado, render condicional y handlers type-safe (2026 best practices: no side-effects, DRY)

import { useState } from 'react';
import { QRScanner } from './components/QRScanner';
import { RegistroForm } from './components/RegistroForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import { useOfflineSync } from './hooks/useOfflineSync'; // Ajusta path

function App() {
  const [punto, setPunto] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(!!localStorage.getItem('adminToken'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));

  const { pendingCount, syncNow } = useOfflineSync(); // Reemplaza el useOfflineSync anterior

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);
    setError(null);  // Limpia error
    setMensaje(null);  // Limpia mensaje viejo
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
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span>Pendientes: {pendingCount}</span>
            <button 
              onClick={syncNow}
              className="bg-white text-yellow-600 px-3 py-1 rounded-md font-medium hover:bg-gray-100 transition"
            >
              Sincronizar ahora
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