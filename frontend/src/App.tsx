// src/App.tsx
import { useState } from 'react';
import { QRScanner } from './components/QRScanner';
import { RegistroForm } from './components/RegistroForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';

function App() {
  const [punto, setPunto] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isAdminMode, setIsAdminMode] = useState<boolean>(
    !!localStorage.getItem('adminToken')
  );
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('adminToken')
  );

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);
    setError(null); // Limpiamos errores previos
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
    setMensaje('Has vuelto al modo Vigilador');
    setError(null);
  };

  const handleScan = (p: number) => setPunto(p);
  const handleSuccess = (msg: string) => {
    setMensaje(msg);
    setPunto(null);
  };
  const handleError = (err: string) => setError(err);
  const handleBack = () => setPunto(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 flex flex-col items-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 tracking-tight">
          Control de Rondas QR
        </h1>

        {/* Botón para entrar a modo admin - solo visible en modo vigilador */}
        {!isAdminMode && (
          <button
            onClick={() => setIsAdminMode(true)}
            className="mb-10 w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 
                     hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold 
                     rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            Ingresar como Administrador →
          </button>
        )}

        {/* Mensajes globales */}
        {mensaje && (
          <div className="mb-6 p-4 bg-green-900/70 border border-green-600 rounded-xl text-center font-medium">
            {mensaje}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/70 border border-red-600 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Contenido principal */}
        {isAdminMode ? (
          token ? (
            <div className="space-y-6">
              <AdminPanel token={token} onLogout={handleAdminLogout} />
            </div>
          ) : (
            <AdminLogin onSuccess={handleAdminLogin} onError={handleError} />
          )
        ) : !punto ? (
          <QRScanner onScan={handleScan} onError={handleError} />
        ) : (
          <RegistroForm
            punto={punto}
            onSuccess={handleSuccess}
            onError={handleError}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

export default App;