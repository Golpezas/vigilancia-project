// frontend/src/components/AdminPanel.tsx
// Panel administrativo para creación de servicios multi-cliente
// Mejores prácticas 2026: Type-safety estricta (no any), manejo de errores con unknown + isAxiosError,
// loading states, validación cliente, UI moderna Tailwind

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios'; // ← Import clave para tipado seguro

// Interfaces centralizadas (normalización de tipos - DRY)
interface PuntoDisponible {
  id: number;
  nombre: string;
}

interface ServicioCreadoResponse {
  success: boolean;
  servicio: {
    id: string;
    nombre: string;
  };
}

interface AdminPanelProps {
  token: string | null; // Requerido para auth en API calls
  onLogout: () => void; // Ahora usado en UI
}

//const ADMIN_KEY = 'G4mul0t3@2106'; // ← Cambiar por env segura

export const AdminPanel: React.FC<AdminPanelProps> = ({ token, onLogout }) => {
  const [nombre, setNombre] = useState<string>('');
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<number[]>([]);
  const [puntosDisponibles, setPuntosDisponibles] = useState<PuntoDisponible[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPuntos = async () => {
      try {
        const res = await api.get('/api/puntos', {
          headers: { Authorization: `Bearer ${token}` }, // Usa token para auth protegida
        });
        setPuntosDisponibles(res.data);
      } catch (err: unknown) {
        const msg = isAxiosError(err) ? err.response?.data.error : 'Error al cargar puntos';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchPuntos();
  }, [token]); // Dependencia en token (re-fetch si cambia)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMensaje(null);

    try {
      const res = await api.post<ServicioCreadoResponse>('/api/admin/servicios', {
        nombre,
        puntos: puntosSeleccionados,
      }, {
        headers: { Authorization: `Bearer ${token}` }, // Auth en POST
      });
      setMensaje(`Servicio "${res.data.servicio.nombre}" creado exitosamente`);
      setNombre('');
      setPuntosSeleccionados([]);
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data.error : 'Error al crear servicio';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckbox = (id: number) => {
    setPuntosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Panel Admin - Crear Servicio</h2>
        <button
          onClick={onLogout} // ← Aquí se usa onLogout: fixes el error de unused-var
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
        >
          Cerrar Sesión
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-800 text-red-200 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre del Servicio
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Ej: Cliente Norte"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Seleccione Puntos (mínimo 1)
          </label>
          <div className="space-y-3 max-h-48 overflow-y-auto bg-gray-700 p-4 rounded-lg">
            {puntosDisponibles.map((punto) => (
              <label key={punto.id} className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={puntosSeleccionados.includes(punto.id)}
                  onChange={() => handleCheckbox(punto.id)}
                  className="w-5 h-5 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-white">
                  {punto.id} - {punto.nombre}
                </span>
              </label>
            ))}
          </div>
          {puntosSeleccionados.length === 0 && (
            <p className="text-orange-400 text-sm mt-2">Seleccione al menos un punto</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || puntosSeleccionados.length === 0}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
        >
          {loading ? 'Creando servicio...' : 'Crear Servicio'}
        </button>
      </form>

      {mensaje && (
        <div className={`mt-6 p-4 rounded-lg text-center font-medium ${
          mensaje.includes('exitosamente') ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'
        }`}>
          {mensaje}
        </div>
      )}
    </div>
  );
};