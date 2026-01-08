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

const ADMIN_KEY = 'tu-clave-secreta-muy-larga-y-segura-2026'; // ← Cambiar por env segura

export const AdminPanel: React.FC = () => {
  const [nombre, setNombre] = useState<string>('');
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<number[]>([]);
  const [puntosDisponibles, setPuntosDisponibles] = useState<PuntoDisponible[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mensaje, setMensaje] = useState<string>('');

  useEffect(() => {
    const puntosHardcoded: PuntoDisponible[] = [
      { id: 1, nombre: 'Entrada Principal' },
      { id: 2, nombre: 'Sector Producción' },
      { id: 3, nombre: 'Depósito' },
      { id: 4, nombre: 'Salida Emergencia' },
      { id: 5, nombre: 'Oficinas' },
      { id: 6, nombre: 'Patio Trasero' },
      { id: 7, nombre: 'Sector Logística' },
      { id: 8, nombre: 'Sala de Servidores' },
    ];

    const loadPuntos = async () => {
      try {
        // Futuro: const response = await api.get('/admin/puntos');
        setPuntosDisponibles(puntosHardcoded);
      } catch (err) {
        setMensaje('Error cargando puntos disponibles');
        console.error('Error en loadPuntos:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPuntos();
  }, []);

  const handleCheckboxChange = (id: number) => {
    setPuntosSeleccionados(prev => 
      prev.includes(id)
        ? prev.filter(pId => pId !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensaje('');
    setLoading(true);

    if (puntosSeleccionados.length === 0) {
      setMensaje('Debe seleccionar al menos un punto');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post<ServicioCreadoResponse>('/admin/servicio', {
        nombre: nombre.trim(),
        puntoIds: puntosSeleccionados,
      }, {
        headers: { 'x-admin-key': ADMIN_KEY },
      });

      if (response.data.success) {
        setMensaje(`Servicio "${response.data.servicio.nombre}" creado exitosamente`);
        setNombre('');
        setPuntosSeleccionados([]);
      }
    } catch (err: unknown) { // ← unknown en lugar de any (type-safe)
      let errorMsg = 'Error desconocido al crear servicio';

      if (isAxiosError(err)) {
        // Error de Axios (network o response)
        if (err.response) {
          // Server respondió con error (400, 401, 500, etc.)
          errorMsg = err.response.data?.error || `Error ${err.response.status}`;
        } else if (err.request) {
          // No hubo respuesta
          errorMsg = 'No se pudo conectar al servidor';
        } else {
          // Error en setup
          errorMsg = err.message;
        }
      } else {
        // Error no-Axios (ej: JSON parse)
        errorMsg = err instanceof Error ? err.message : String(err);
      }

      setMensaje(`Error: ${errorMsg}`);
      console.error('Error creando servicio:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && puntosDisponibles.length === 0) {
    return <div className="text-center mt-8 text-white">Cargando panel administrativo...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-6 bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Panel Administrativo - Crear Servicio
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nombre del Servicio/Cliente
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minLength={3}
            placeholder="Ej: Edificio Norte"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Puntos asignados al servicio
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto bg-gray-700 p-4 rounded-lg">
            {puntosDisponibles.map((punto) => (
              <label
                key={punto.id}
                className="flex items-center space-x-3 text-gray-200 hover:bg-gray-600 p-2 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={puntosSeleccionados.includes(punto.id)}
                  onChange={() => handleCheckboxChange(punto.id)}
                  className="w-5 h-5 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">
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