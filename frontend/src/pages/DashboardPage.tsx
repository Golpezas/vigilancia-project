// src/pages/DashboardPage.tsx
// Dashboard cliente para monitoreo de vigiladores - UI moderna, responsive
// Mejores prácticas 2026: React Query v5 para fetching/caching, Tailwind v4, Chart.js v5, Leaflet para mapas

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto'; // Chart.js v5
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { z } from 'zod';
import { formatArgentina } from '../utils/dateUtils'; // date-fns-tz para normalización AR

// Tipos originales del backend (ya no se usan directamente,
// ahora validamos y normalizamos con Zod → NormalizedRondas)
// import type { RondasPorVigilador, RegistroReporte } from '../types';

// Schema Zod para normalización de reportes (DRY con backend)
const RegistroSchema = z.object({
  punto: z.string(),
  timestamp: z.string().datetime(),
  geo: z.object({ lat: z.number(), long: z.number() }).nullable(),
  novedades: z.string().nullable(),
  alerta: z.string().optional(),
});

const RondasSchema = z.record(z.string(), z.array(RegistroSchema));

type NormalizedRondas = z.infer<typeof RondasSchema>;

interface DashboardProps {
  servicioId: string; // Del login JWT o selección admin
}

/**
 * Dashboard para monitoreo estadístico y control de rondas.
 * Agrupaciones: por vigilador, día, servicio.
 * Stats: totales, delays.
 * Visual: tabla, chart, mapa.
 */
const DashboardPage: React.FC<DashboardProps> = ({ servicioId }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedVigilador, setSelectedVigilador] = useState<string | null>(null);

  // Fetch reportes con filtros (caching React Query, type-safe)
  const { data, isLoading, error } = useQuery<NormalizedRondas, Error>({
    queryKey: ['reportes', servicioId, selectedDate, selectedVigilador],
    queryFn: async () => {
      const res = await api.get('/reportes/rondas', {
        params: {
          servicioId,
          fechaDesde: `${selectedDate}T00:00:00-03:00`, // Normalización AR start
          fechaHasta: `${selectedDate}T23:59:59-03:00`, // Normalización AR end
          vigiladorId: selectedVigilador,
        },
      });
      const parsed = RondasSchema.safeParse(res.data);
      if (!parsed.success) throw new Error('Datos de reportes inválidos: ' + parsed.error.issues.map(i => i.message).join(', '));
      return parsed.data;
    },
  });

  if (isLoading) return <div className="text-center py-10 text-gray-400">Cargando reportes...</div>;
  if (error) return <div className="text-red-500 text-center">Error: {error.message}</div>;

  // Análisis estadístico (delays >15min, totales)
  const vigiladores = Object.keys(data ?? {});
  const totalRondas = Object.values(data ?? {}).reduce((acc, ronda) => acc + ronda.length, 0);
  const totalDelays = Object.values(data ?? {}).reduce(
    (acc, ronda) => acc + ronda.filter(r => r.alerta).length,
    0
  );

  // Datos para chart (rondas por vigilador)
  const chartData = {
    labels: vigiladores,
    datasets: [{
      label: 'Rondas completadas',
      data: vigiladores.map(v => data?.[v]?.length || 0),
      backgroundColor: 'rgba(30, 64, 175, 0.6)', // Tailwind blue-800
    }],
  };

  return (
    <div className="space-y-8">
      {/* Filtros (control preciso por día/vigilador) */}
      <div className="flex space-x-4">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Fecha</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Vigilador</span>
          <select
            value={selectedVigilador || ''}
            onChange={(e) => setSelectedVigilador(e.target.value || null)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          >
            <option value="">Todos</option>
            {vigiladores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      {/* Stats Cards (estadístico rápido) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-800 rounded-lg text-center shadow-md">
          <h3 className="text-lg font-bold text-white">Total Rondas</h3>
          <p className="text-2xl text-blue-400">{totalRondas}</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg text-center shadow-md">
          <h3 className="text-lg font-bold text-white">Delays Excesivos</h3>
          <p className="text-2xl text-red-500">{totalDelays}</p>
        </div>
      </div>

      {/* Tabla organizada (agrupada por vigilador, columns claras) */}
      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-3 px-4 text-left">Vigilador</th>
              <th className="py-3 px-4 text-left">Punto</th>
              <th className="py-3 px-4 text-left">Timestamp (AR)</th>
              <th className="py-3 px-4 text-left">Geo</th>
              <th className="py-3 px-4 text-left">Novedades</th>
              <th className="py-3 px-4 text-left">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {vigiladores.flatMap(v => 
              data?.[v]?.map((reg, idx) => (
                <tr key={`${v}-${idx}`} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-3 px-4">{v}</td>
                  <td className="py-3 px-4">{reg.punto}</td>
                  <td className="py-3 px-4">{formatArgentina(reg.timestamp)}</td>
                  <td className="py-3 px-4">{reg.geo ? `${reg.geo.lat.toFixed(6)}, ${reg.geo.long.toFixed(6)}` : 'N/A'}</td>
                  <td className="py-3 px-4">{reg.novedades ?? 'OK'}</td>
                  <td className="py-3 px-4 text-red-500">{reg.alerta ?? 'OK'}</td>
                </tr>
              ))
            )}
            {totalRondas === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">No hay registros para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Gráfico estadístico (rondas por vigilador) */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-white mb-4">Rondas por Vigilador</h3>
        <Bar data={chartData} options={{ responsive: true, scales: { y: { beginAtZero: true } } }} />
      </div>

      {/* Mapa Geo (visualización espacial para control) */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-white mb-4">Mapa de Geolocalizaciones</h3>
        <MapContainer center={[-34.5467, -58.4596]} zoom={15} style={{ height: '400px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {vigiladores.flatMap(v => 
            data?.[v]?.filter(r => r.geo).map((reg, idx) => (
              <Marker key={`${v}-${idx}`} position={[reg.geo!.lat, reg.geo!.long]} />
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default DashboardPage;