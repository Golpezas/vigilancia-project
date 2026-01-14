// frontend/src/components/AdminPanel.tsx
// Panel administrativo para creación de servicios multi-cliente con integración de dashboard
// Mejores prácticas 2026: Type-safety estricta, Zod runtime, manejo de errores robusto, UI moderna

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import DashboardPage from '../pages/DashboardPage';

// Schemas Zod (DRY y validación estricta)
const PuntoSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string().min(1),
});

const ServicioSchema = z.object({
  nombre: z.string().min(1),
  puntoIds: z.array(z.number().int().positive()).min(1, 'Seleccione al menos un punto'),
});

type PuntoDisponible = z.infer<typeof PuntoSchema>;
type ServicioValues = z.infer<typeof ServicioSchema>;

interface AdminPanelProps {
  token: string;
  onLogout: () => void;
  servicioId?: string;
}

/**
 * Panel Admin con creación de servicios y dashboard integrado
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({ token, onLogout, servicioId }) => {
  const [nombre, setNombre] = useState<string>('');
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<number[]>([]);
  const [puntosDisponibles, setPuntosDisponibles] = useState<PuntoDisponible[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPuntos = async () => {
      setLoading(true);
      setError(null);

      try {
        // Cambio clave: ruta relativa SIN /api inicial
        const res = await api.get('/puntos', {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Validación y normalización estricta con Zod
        const parsedPuntos = z.array(PuntoSchema).safeParse(res.data);

        if (!parsedPuntos.success) {
          throw new Error('Datos de puntos inválidos: ' + parsedPuntos.error.issues.map(i => i.message).join(', '));
        }

        setPuntosDisponibles(parsedPuntos.data);
      } catch (err: unknown) {
        const msg = isAxiosError(err)
          ? err.response?.data?.error || 'Error al cargar puntos disponibles'
          : 'Error desconocido al cargar puntos';
        setError(msg);
        console.error('[FETCH PUNTOS ERROR]', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPuntos();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);
    setError(null);

    const data: ServicioValues = { nombre, puntoIds: puntosSeleccionados };

    // Validación local temprana
    const parsedData = ServicioSchema.safeParse(data);
    if (!parsedData.success) {
      setError(parsedData.error.issues.map(i => i.message).join(', '));
      setLoading(false);
      return;
    }

    try {
      // Cambio clave: ruta relativa SIN /api inicial
      const res = await api.post('/admin/crear-servicio', parsedData.data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const successSchema = z.object({ success: z.boolean() });
      const parsedRes = successSchema.safeParse(res.data);

      if (!parsedRes.success || !parsedRes.data.success) {
        throw new Error(res.data?.error || 'Error al crear servicio');
      }

      setMensaje(`Servicio "${nombre}" creado exitosamente con ${puntosSeleccionados.length} puntos`);
      setNombre('');
      setPuntosSeleccionados([]);
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? err.response?.data?.error || 'Error al crear servicio'
        : 'Error desconocido';
      setError(msg);
      console.error('[CREAR SERVICIO ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckbox = (id: number) => {
    setPuntosSeleccionados(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-gray-900 rounded-xl shadow-2xl border border-gray-800">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-white">Panel Admin - Crear Servicio</h2>
        <button 
          onClick={onLogout} 
          className="py-3 px-6 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition shadow-md"
        >
          Logout y Volver a Modo Vigilador
        </button>
      </div>

      {error && <div className="mb-6 p-4 bg-red-900/70 text-red-200 rounded-lg text-center border border-red-700">{error}</div>}

      {mensaje && <div className="mb-6 p-4 bg-green-900/70 text-green-200 rounded-lg text-center border border-green-700">{mensaje}</div>}

      {loading ? (
        <p className="text-center text-gray-400">Cargando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nombre del Servicio</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              placeholder="Ej: Cliente Norte"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Seleccione Puntos (mínimo 1)</label>
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
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition"
          >
            {loading ? 'Creando...' : 'Crear Servicio'}
          </button>
        </form>
      )}

      {/* Integración de Dashboard (subcomponente desacoplado) */}
      <div className="mt-12 border-t border-gray-700 pt-6">
        <h2 className="text-2xl font-bold text-white mb-4">Dashboard de Rondas</h2>
        {servicioId ? (
          <DashboardPage servicioId={servicioId} /> // Prop normalizada desde token
        ) : (
          <p className="text-gray-400 text-center">No hay ID de servicio disponible. Verifica login.</p>
        )}
      </div>
    </div>
  );
};