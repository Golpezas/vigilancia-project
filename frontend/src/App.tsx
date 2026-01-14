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
  const [isAdminMode, setIsAdminMode] = useState<boolean>(!!localStorage.getItem('adminToken'));
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);  // ← Asegura cambio de modo
    setError(null);        // Limpia errores
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
    setMensaje('Vuelto a modo Vigilador');
  };

  const handleAdminBack = () => {
    setIsAdminMode(false);  // ← Nueva handler para back desde login
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Control de Rondas QR</h1>

        {!isAdminMode && (
          <button
            onClick={() => setIsAdminMode(true)}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg mb-8"
          >
            Ingresar como Administrador
          </button>
        )}

        {mensaje && <div className="mb-4 p-4 bg-green-800 rounded">{mensaje}</div>}
        {error && <div className="mb-4 p-4 bg-red-800 rounded">{error}</div>}

        {isAdminMode ? (
          token ? (
            <AdminPanel token={token} onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin
              onSuccess={handleAdminLogin}
              onError={handleError}
              onBack={handleAdminBack}  // ← Pasamos la nueva prop
            />
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