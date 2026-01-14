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
    !!localStorage.getItem('adminToken') // Persistencia inicial
  );
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
    setMensaje('Has vuelto al modo Vigilador');
  };

  const handleScan = (p: number) => setPunto(p);
  const handleSuccess = (msg: string) => {
    setMensaje(msg);
    setPunto(null);
  };
  const handleError = (err: string) => setError(err);
  const handleBack = () => setPunto(null);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8 tracking-tight">
          Control de Rondas QR
        </h1>

        {/* Botón de cambio de modo - SIEMPRE visible cuando NO estamos en admin */}
        {!isAdminMode && (
          <button
            onClick={() => setIsAdminMode(true)}
            className="mb-8 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 
                       active:bg-indigo-800 text-white font-medium rounded-xl 
                       transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Ingresar como Administrador →
          </button>
        )}

        {/* Mensajes globales */}
        {mensaje && (
          <div className="mb-6 p-4 bg-green-900/60 border border-green-700 rounded-xl text-center">
            {mensaje}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/60 border border-red-700 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Renderizado condicional principal */}
        {isAdminMode ? (
          token ? (
            <AdminPanel token={token} onLogout={handleAdminLogout} />
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