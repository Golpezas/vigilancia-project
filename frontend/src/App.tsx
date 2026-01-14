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
  
  // Estados para el flujo de administración
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);          // ← Esto es lo que activa el panel
    setError(null);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
    setMensaje(null);
    setError(null);
  };

  const handleScan = (scannedPunto: number) => {
    setPunto(scannedPunto);
  };

  const handleSuccess = (msg: string) => {
    setMensaje(msg);
    setPunto(null); // Volver al scanner después de registrar
  };

  const handleError = (errMsg: string) => {
    setError(errMsg);
  };

  const handleBack = () => {
    setPunto(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white p-4">
        <h1 className="text-2xl font-bold">Control de Rondas - Vigilancia</h1>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Mensajes globales - siempre visibles */}
        {mensaje && (
          <div className="mt-4 p-5 bg-green-100 border border-green-400 text-green-800 rounded-lg text-center font-bold">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mt-4 p-5 bg-red-100 border border-red-400 text-red-800 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Lógica de renderizado condicional */}
        {isAdminMode ? (
          // Estamos en modo administrador
          token ? (
            <AdminPanel 
              token={token} 
              onLogout={handleAdminLogout} 
            />
          ) : (
            <AdminLogin 
              onSuccess={handleAdminLogin} 
              onError={handleError} 
            />
          )
        ) : (
          // Modo normal (vigilador)
          !punto ? (
            <div className="max-w-md mx-auto">
              <QRScanner 
                onScan={handleScan} 
                onError={handleError} 
              />
              
              {/* Botón para entrar al modo admin */}
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setIsAdminMode(true)}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition shadow-md"
                >
                  Modo Administrador
                </button>
              </div>
            </div>
          ) : (
            <RegistroForm
              punto={punto}
              onSuccess={handleSuccess}
              onError={handleError}
              onBack={handleBack}
            />
          )
        )}
      </main>
    </div>
  );
}

export default App;