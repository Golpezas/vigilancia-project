// src/pages/DashboardPage.tsx
// Dashboard cliente para monitoreo de vigiladores - UI moderna, responsive
// Mejores prácticas 2026: React Query v5 para fetching/caching, Tailwind v4, Chart.js v5, Leaflet para mapas,
// useMap hook para type-safety en Leaflet (evita internals frágiles y any), invalidateSize en useEffect con delay mínimo,
// contenedor con height explícita y verificación de visibilidad, logs estructurados para depuración práctica

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto'; // Chart.js v5
import L from 'leaflet'; // Import completo para custom icons y tipado L.Map
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'; // ← Agrega useMap
import 'leaflet/dist/leaflet.css';
import { z } from 'zod';
import { parse } from 'date-fns'; // Para parsear formatos AR no-ISO
import { formatInTimeZone } from 'date-fns-tz';
import { formatArgentina } from '../utils/dateUtils';

interface ChartDataType {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
  }>;
}

// Memoized Chart Component (evita re-mounts y bucles)
const MemoizedBarChart = React.memo(({ data }: { data: ChartDataType }) => (
  <div className="h-80">
    <Bar
      data={data}
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
));

const TIMEZONE = 'America/Argentina/Buenos_Aires';

// Schema Zod actualizado: transforma timestamp AR a ISO
const RegistroSchema = z.object({
  punto: z.string().min(1),
  timestamp: z.string().transform(val => {
    try {
      const parsed = parse(val, 'dd/MM/yyyy HH:mm:ss', new Date());
      return parsed.toISOString(); // Normaliza a ISO
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

const DashboardPage: React.FC<DashboardProps> = ({ servicioId }) => {
  const today = new Date();
  const defaultDesde = new Date(today);
  defaultDesde.setDate(today.getDate() - 7);

  const [fechaDesde, setFechaDesde] = useState<string>(
    formatInTimeZone(defaultDesde, TIMEZONE, 'yyyy-MM-dd')
  );
  const [fechaHasta, setFechaHasta] = useState<string>(
    formatInTimeZone(today, TIMEZONE, 'yyyy-MM-dd')
  );
  
  // Cambiamos el tipo: ahora guarda el nombre completo (string) o null
  const [selectedVigiladorId, setSelectedVigiladorId] = useState<string | null>(null);

  // Fetch con React Query - caching alto, no retry en errores comunes
  const { data, isLoading, error } = useQuery<NormalizedRondas, Error>({
    queryKey: ['reportes', servicioId, fechaDesde, fechaHasta, selectedVigiladorId], // Actualiza queryKey con el ID numérico
    queryFn: async () => {
      const params = {
        servicioId,
        fechaDesde: `${fechaDesde}T00:00:00-03:00`,
        fechaHasta: `${fechaHasta}T23:59:59-03:00`,
        // Envía solo el legajo numérico como vigiladorId (asumiendo que el backend lo espera así)
        vigiladorId: selectedVigiladorId || undefined,
      };

      console.log('[REPORTES QUERY] Enviando parámetros:', params); // ← para depurar

      const res = await api.get('/reportes/rondas', { params });
      
      const parsed = RondasSchema.safeParse(res.data);
      if (!parsed.success) {
        console.error('[REPORTES PARSE ERROR]', parsed.error);
        throw new Error('Datos de reportes inválidos: ' + parsed.error.issues.map(i => i.message).join(', '));
      }
      return parsed.data;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    retry: false,
  });

  // Cálculos derivados
  const vigiladores = useMemo(() => Object.keys(data ?? {}), [data]);

  const totalRondas = useMemo(() => 
    Object.values(data ?? {}).reduce((acc, ronda) => acc + ronda.length, 0),
  [data]);

  const totalDelays = useMemo(() => 
    Object.values(data ?? {}).reduce((acc, ronda) => 
      acc + ronda.filter(r => r.alerta).length, 0),
  [data]);

  // chartData con useMemo (dependencias estrictas)
  const chartData = useMemo(() => {
    if (!vigiladores.length) return null;

    return {
      labels: vigiladores,
      datasets: [
        {
          label: 'Rondas completadas',
          data: vigiladores.map(v => data?.[v]?.length || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    } as ChartDataType;
  }, [data, vigiladores]); // Solo recalcula si data o vigiladores cambian

  // Render condicional (solo JSX, sin hooks)
  if (isLoading) {
    return <div className="text-center py-10 text-gray-400 animate-pulse">Cargando reportes...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400 bg-red-900/30 rounded-lg p-6">
        Error al cargar reportes: {error.message}
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
    <div className="space-y-8">
      {/* Filtros */}
      <div className="flex space-x-4">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Desde</span>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Hasta</span>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          />
        </label>
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-300 mb-2">Vigilador</span>
          <select
            value={selectedVigiladorId || ''}
            onChange={(e) => setSelectedVigiladorId(e.target.value || null)}
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500"
          >
            <option value="">Todos</option>
            {vigiladores.map(nombre => {
              // Extrae el legajo del nombre (asumiendo formato "[Nombre] - Legajo [Número]")
              const legajo = nombre.split(' - Legajo ')?.[1] || ''; // Fallback a '' si no matchea
              return (
                <option key={nombre} value={legajo}>
                  {nombre}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {/* Stats Cards */}
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

      {/* Tabla con más espacio */}
      <div className="overflow-x-auto">
        <table className="w-full bg-gray-800 rounded-lg overflow-hidden shadow-md">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="py-4 px-6 text-left">Vigilador</th>
              <th className="py-4 px-6 text-left">Punto</th>
              <th className="py-4 px-6 text-left">Hora (AR)</th>
              <th className="py-4 px-6 text-left">Geo</th>
              <th className="py-4 px-6 text-left">Novedades</th>
              <th className="py-4 px-6 text-left">Alerta</th>
            </tr>
          </thead>
          <tbody>
            {vigiladores.flatMap(v => 
              data?.[v]?.map((reg, idx) => (
                <tr key={`${v}-${idx}`} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-4 px-6">{v}</td>
                  <td className="py-4 px-6">{reg.punto}</td>
                  <td className="py-4 px-6">{formatArgentina(reg.timestamp)}</td>
                  <td className="py-4 px-6">{reg.geo ? `${reg.geo.lat.toFixed(6)}, ${reg.geo.long.toFixed(6)}` : 'N/A'}</td>
                  <td className="py-4 px-6">{reg.novedades ?? 'OK'}</td>
                  <td className="py-4 px-6 text-red-500">{reg.alerta ?? 'OK'}</td>
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

      {/* Gráfico - solo si hay data y chartData existe */}
      {!noData && chartData && vigiladores.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md" key="chart-container">
          <h3 className="text-xl font-bold text-white mb-4">Rondas por Vigilador</h3>
          <MemoizedBarChart data={chartData} />
        </div>
      )}

      {/* Mapa de Últimas Geolocalizaciones */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold text-white mb-4">Mapa de Últimas Geolocalizaciones</h3>
        
        {/* Contenedor con altura forzada + fallback */}
        <div 
          className="relative w-full h-[400px] min-h-[400px] rounded-lg overflow-hidden border border-gray-700 bg-gray-900"
          style={{ height: '400px' }} // fallback hard-coded para debug (después podés sacarlo)
        >
          <MapContainer
            center={[-34.5467, -58.4596]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            className="absolute inset-0"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* Componente que observa y fuerza resize */}
            <MapResizeObserver />

            {/* Tus markers... */}
            {vigiladores.flatMap(v => 
              data?.[v]?.filter(r => r.geo).map((reg, idx) => {
                console.log(`[MAPA DEBUG] Creando marker ${idx} para ${v} en ${reg.punto}`, {
                  lat: reg.geo!.lat,
                  lng: reg.geo!.long,
                });

                const customIcon = L.divIcon({
                  className: 'bg-transparent',
                  html: `
                    <div style="
                      background-color: white;
                      width: 38px;
                      height: 38px;
                      border-radius: 50%;
                      border: 4px solid #1e40af;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-weight: bold;
                      font-size: 20px;
                      color: #1e40af;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                      text-align: center;
                      line-height: 38px;
                    ">
                      M
                    </div>
                  `,
                  iconSize: [38, 38],
                  iconAnchor: [19, 19],
                });

                console.log(`[MAPA DEBUG] Ícono custom creado para marker ${idx}`);

                return (
                  <Marker
                    key={`${v}-${idx}`}
                    position={[reg.geo!.lat, reg.geo!.long]}
                    icon={customIcon}
                    title={`${v} - ${reg.punto} - ${formatArgentina(reg.timestamp)}`}
                  />
                );
              })
            )}
          </MapContainer>

          {/* Fallback */}
          {vigiladores.reduce((acc, v) => acc + (data?.[v]?.filter(r => r.geo).length || 0), 0) === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900/80">
              No hay geolocalizaciones registradas para mostrar en el mapa
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Observa cambios de tamaño reales y fuerza invalidateSize
const MapResizeObserver = () => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();

    console.log('[MAPA DEBUG] Contenedor inicial:', {
      clientHeight: container.clientHeight,
      offsetHeight: container.offsetHeight,
      computedStyleHeight: window.getComputedStyle(container).height,
    });

    // ResizeObserver moderno (mejor que timeout)
    const resizeObserver = new ResizeObserver(() => {
      console.log('[MAPA DEBUG] Resize detectado → invalidando tamaño');
      map.invalidateSize({ animate: false });
    });

    resizeObserver.observe(container);

    // Forzamos inicial después de un micro-delay (muy común)
    const initialTimer = setTimeout(() => {
      console.log('[MAPA DEBUG] Forzado inicial invalidateSize');
      map.invalidateSize({ animate: false });
    }, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(initialTimer);
      console.log('[MAPA DEBUG] ResizeObserver cleanup');
    };
  }, [map]);

  return null;
};

export default DashboardPage;