// src/pages/DashboardPage.tsx
// Dashboard cliente para monitoreo de vigiladores - UI moderna, responsive
// Mejores prácticas 2026: React Query v5, Tailwind v4, Chart.js v5, Leaflet, Zod validación,
// manejo elegante de "no data", rango de fechas amplio por default, type-safety estricto

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto'; // Chart.js v5
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { formatArgentina } from '../utils/dateUtils';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Schema Zod para respuesta normalizada del backend (DRY)
const RegistroSchema = z.object({
  punto: z.string().min(1),
  timestamp: z.string().datetime(),
  geo: z.object({ lat: z.number(), long: z.number() }).nullable(),
  novedades: z.string().nullable(),
  alerta: z.string().optional(),
});

const RondasSchema = z.record(z.string(), z.array(RegistroSchema));

type NormalizedRondas = z.infer<typeof RondasSchema>;

interface DashboardProps {
  servicioId: string;
}

/**
 * Dashboard de monitoreo de rondas con estadísticas, tabla, gráfico y mapa.
 * - Rango por default: últimos 7 días (para mostrar datos existentes).
 * - Muestra mensaje amigable si no hay registros (evita error rojo).
 * - Filtros por fecha y vigilador con UI clara.
 */
const DashboardPage: React.FC<DashboardProps> = ({ servicioId }) => {
  // Rango por default: últimos 7 días hasta hoy
  const today = new Date();
  const defaultDesde = new Date(today);
  defaultDesde.setDate(today.getDate() - 7);

  const [fechaDesde, setFechaDesde] = useState<string>(
    formatInTimeZone(defaultDesde, TIMEZONE, "yyyy-MM-dd")
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    formatInTimeZone(today, TIMEZONE, "yyyy-MM-dd")
  );
  const [selectedVigilador, setSelectedVigilador] = useState<string | null>(null);

  // Fetch con React Query - caching inteligente
  const { data, isLoading, error } = useQuery<NormalizedRondas, Error>({
    queryKey: ['reportes', servicioId, fechaDesde, fechaHasta, selectedVigilador],
    queryFn: async () => {
      const res = await api.get('/reportes/rondas', {
        params: {
          servicioId,
          fechaDesde: `${fechaDesde}T00:00:00-03:00`,
          fechaHasta: `${fechaHasta}T23:59:59-03:00`,
          vigiladorId: selectedVigilador || undefined,
        },
      });

      const parsed = RondasSchema.safeParse(res.data);
      if (!parsed.success) {
        throw new Error(`Datos inválidos: ${parsed.error.issues.map(i => i.message).join(', ')}`);
      }

      return parsed.data;
    },
    // No reintentamos si es 400 (no data) - evita spam
    retry: (failureCount, error) => failureCount < 2 && error.message.includes('500'),
  });

  // Memo: lista de vigiladores únicos
  const vigiladores = useMemo(() => Object.keys(data ?? {}), [data]);

  // Stats calculados
  const totalRondas = useMemo(
    () => Object.values(data ?? {}).reduce((acc, ronda) => acc + ronda.length, 0),
    [data]
  );

  const totalDelays = useMemo(
    () => Object.values(data ?? {}).reduce((acc, ronda) => acc + ronda.filter(r => r.alerta).length, 0),
    [data]
  );

  // Datos para Bar chart
  const chartData = useMemo(
    () => ({
      labels: vigiladores,
      datasets: [{
        label: 'Rondas completadas',
        data: vigiladores.map(v => data?.[v]?.length || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.7)', // blue-500 con opacidad
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      }],
    }),
    [vigiladores, data]
  );

  if (isLoading) {
    return <div className="text-center py-12 text-gray-400 animate-pulse">Cargando reportes...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400 bg-red-900/30 rounded-lg p-6">
        Error al cargar reportes: {error.message}
        <br />
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const noData = totalRondas === 0;

  return (
    <div className="space-y-8 p-4 md:p-6">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Vigilador</label>
          <select
            value={selectedVigilador || ''}
            onChange={e => setSelectedVigilador(e.target.value || null)}
            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {vigiladores.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado: No data */}
      {noData && (
        <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-8 text-center text-gray-300">
          <h3 className="text-xl font-semibold mb-2">No hay rondas registradas</h3>
          <p className="mb-4">
            No se encontraron registros para el período seleccionado ({fechaDesde} → {fechaHasta}).
          </p>
          <p className="text-sm text-gray-400">
            Intenta ampliar el rango de fechas o verifica que los vigiladores hayan escaneado puntos.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      {!noData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-medium text-blue-200">Total Rondas</h3>
            <p className="text-4xl font-bold text-white mt-2">{totalRondas}</p>
          </div>
          <div className="bg-gradient-to-br from-red-900 to-red-800 p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-medium text-red-200">Delays Excesivos</h3>
            <p className="text-4xl font-bold text-white mt-2">{totalDelays}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      {!noData && (
        <div className="overflow-x-auto bg-gray-800 rounded-xl shadow-lg">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Vigilador</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Punto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Hora (AR)</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Geo</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Novedades</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {vigiladores.flatMap(v =>
                (data?.[v] ?? []).map((reg, idx) => (
                  <tr key={`${v}-${idx}`} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{v}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{reg.punto}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatArgentina(reg.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {reg.geo ? `${reg.geo.lat.toFixed(6)}, ${reg.geo.long.toFixed(6)}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">{reg.novedades ?? 'Sin novedades'}</td>
                    <td className="px-6 py-4">
                      {reg.alerta ? (
                        <span className="text-red-400 font-medium">{reg.alerta}</span>
                      ) : (
                        <span className="text-green-400">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico */}
      {!noData && vigiladores.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6">Rondas por Vigilador</h3>
          <div className="h-80">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true, ticks: { color: '#9ca3af' } },
                  x: { ticks: { color: '#9ca3af' } },
                },
                plugins: { legend: { labels: { color: '#e5e7eb' } } },
              }}
            />
          </div>
        </div>
      )}

      {/* Mapa */}
      {!noData && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-bold text-white mb-6">Mapa de Últimas Geolocalizaciones</h3>
          <div className="h-96 rounded-lg overflow-hidden">
            <MapContainer center={[-34.5467, -58.4596]} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {vigiladores.flatMap(v =>
                (data?.[v] ?? [])
                  .filter(r => r.geo)
                  .map((reg, idx) => (
                    <Marker
                      key={`${v}-${idx}`}
                      position={[reg.geo!.lat, reg.geo!.long]}
                      title={`${v} - ${reg.punto}`}
                    />
                  ))
              )}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;