// src/pages/DashboardPage.tsx
// Dashboard cliente para monitoreo de vigiladores - UI moderna, responsive
// Mejores prácticas 2026: React Query v5 para fetching/caching, Tailwind v4, Chart.js v5, Leaflet para mapas,
// Zod con transform para normalización fechas AR, manejo no-data UX, rango default amplio, type-safety estricto

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto'; // Chart.js v5
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { z } from 'zod';
import { parse } from 'date-fns'; // Para parsear formatos AR no-ISO
import { formatInTimeZone } from 'date-fns-tz';
import { formatArgentina } from '../utils/dateUtils';

const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Schema Zod flexible: acepta timestamp en formato AR (dd/MM/yyyy HH:mm:ss) y transforma a ISO/Date
const RegistroSchema = z.object({
  punto: z.string().min(1),
  timestamp: z.string().transform(val => {
    try {
      const parsed = parse(val, 'dd/MM/yyyy HH:mm:ss', new Date()); // Parsea AR format
      if (isNaN(parsed.getTime())) throw new Error('Invalid date');
      return parsed.toISOString(); // Normaliza a ISO para consistencia
    } catch {
      throw new Error('Formato de fecha inválido');
    }
  }),
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
 * Dashboard para monitoreo de rondas con filtros, stats, tabla, gráfico y mapa.
 * - Rango default: últimos 7 días para capturar datos existentes.
 * - Manejo no-data: mensaje amigable.
 * - Vigilador: muestra nombre/legajo en vez de ID (asumiendo backend lo devuelve).
 * - Delays: calculados en backend (>1 hora).
 * - Tabla: más espacio y responsive.
 */
const DashboardPage: React.FC<DashboardProps> = ({ servicioId }) => {
  // Rango default: últimos 7 días
  const today = new Date();
  const defaultDesde = new Date(today);
  defaultDesde.setDate(today.getDate() - 7);

  const [fechaDesde, setFechaDesde] = useState<string>(
    formatInTimeZone(defaultDesde, TIMEZONE, 'yyyy-MM-dd')
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    formatInTimeZone(today, TIMEZONE, 'yyyy-MM-dd')
  );
  const [selectedVigilador, setSelectedVigilador] = useState<string | null>(null);

  // Fetch con React Query
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
      if (!parsed.success) throw new Error('Datos de reportes inválidos: ' + parsed.error.issues.map(i => i.message).join(', '));
      return parsed.data;
    },
    retry: (failureCount, err) => failureCount < 2 && !err.message.includes('400'),
  });

  if (isLoading) return <div className="text-center py-10 text-gray-400">Cargando reportes...</div>;
  if (error) return <div className="text-red-500 text-center py-10">Error: {error.message}</div>;

  const vigiladores = Object.keys(data ?? {});
  const totalRondas = vigiladores.reduce((acc, v) => acc + (data?.[v]?.length || 0), 0);
  const totalDelays = vigiladores.reduce((acc, v) => acc + (data?.[v]?.filter(r => r.alerta).length || 0), 0);

  const chartData = {
    labels: vigiladores,
    datasets: [{
      label: 'Rondas completadas',
      data: vigiladores.map(v => data?.[v]?.length || 0),
      backgroundColor: 'rgba(30, 64, 175, 0.6)',
    }],
  };

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Vigilador</span>
          <select
            value={selectedVigilador || ''}
            onChange={e => setSelectedVigilador(e.target.value || null)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          >
            <option value="">Todos</option>
            {vigiladores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-800 rounded-lg text-center shadow-md">
          <h3 className="text-lg font-bold text-white">Total Rondas</h3>
          <p className="text-2xl text-green-600">{totalRondas}</p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg text-center shadow-md">
          <h3 className="text-lg font-bold text-white">Delays Excesivos</h3>
          <p className="text-2xl text-red-600">{totalDelays}</p>
        </div>
      </div>

      {/* Tabla con más espacio */}
      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-4 px-8 text-left">Vigilador</th>
              <th className="py-4 px-8 text-left">Punto</th>
              <th className="py-4 px-8 text-left">Hora (AR)</th>
              <th className="py-4 px-8 text-left">Geo</th>
              <th className="py-4 px-8 text-left">Novedades</th>
              <th className="py-4 px-8 text-left">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {vigiladores.flatMap(v => 
              data?.[v]?.map((reg, idx) => (
                <tr key={`${v}-${idx}`} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-4 px-8">{v}</td>
                  <td className="py-4 px-8">{reg.punto}</td>
                  <td className="py-4 px-8">{formatArgentina(reg.timestamp)}</td>
                  <td className="py-4 px-8">{reg.geo ? `${reg.geo.lat.toFixed(6)}, ${reg.geo.long.toFixed(6)}` : 'N/A'}</td>
                  <td className="py-4 px-8">{reg.novedades ?? 'OK'}</td>
                  <td className="py-4 px-8 text-red-600">{reg.alerta ?? 'OK'}</td>
                </tr>
              ))
            )}
            {totalRondas === 0 && (
              <tr>
                <td colSpan={6} className="py-6 px-8 text-center text-gray-400">No hay registros para los filtros seleccionados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Gráfico */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-white mb-4">Rondas por Vigilador</h3>
        <Bar data={chartData} options={{ responsive: true, scales: { y: { beginAtZero: true } } }} />
      </div>

      {/* Mapa */}
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