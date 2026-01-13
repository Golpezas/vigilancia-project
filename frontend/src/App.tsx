// src/App.tsx
import { useState } from 'react';
import { QRScanner } from './components/QRScanner';
import { RegistroForm } from './components/RegistroForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin'; // Importar si vas a usar login persistente

function App() {
  const [punto, setPunto] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false); // Renombrado para claridad (evita confusión con auth)
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken') || null); // Persistencia básica

  const handleScan = (punto: number) => {
    setPunto(punto);
    setMensaje(null);
    setError(null);
  };

  const handleBack = () => {
    setPunto(null);
    setMensaje(null);
    setError(null);
  };

  const handleSuccess = (msg: string) => {
    setMensaje(msg);
    setTimeout(handleBack, 3000);
  };

  const handleError = (err: string) => {
    setError(err);
    setTimeout(() => setError(null), 5000);
  };

  const handleAdminLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
    setIsAdminMode(true);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    setIsAdminMode(false);
  };

  // Toggle temporal para dev - En prod, usa routing/auth guards (e.g., React Router + JWT validation)
  const toggleAdmin = () => {
    if (isAdminMode) {
      handleAdminLogout();
    } else {
      setIsAdminMode(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-800 text-white p-6 text-center">
        <h1 className="text-2xl font-bold">Control de Rondas - Vigilancia</h1>
        <button
          onClick={toggleAdmin}
          className="mt-2 px-4 py-1 bg-white text-blue-800 rounded font-medium"
        >
          {isAdminMode ? 'Volver a Vigilador' : 'Modo Admin'}
        </button>
      </header>

      <main className="container mx-auto px-4">
        {mensaje && (
          <div className="mt-8 p-6 bg-green-100 border border-green-400 text-green-800 rounded-lg text-center text-xl font-bold">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mt-8 p-6 bg-red-100 border border-red-400 text-red-800 rounded-lg text-center">
            {error}
          </div>
        )}

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
      </main>
    </div>
  );
}

export default App;