// src/pages/DashboardPage.tsx
// Dashboard cliente para monitoreo de vigiladores - UI moderna, responsive
// Mejores prácticas 2026: React Query v5 para fetching/caching, Tailwind v4, Chart.js v5, Leaflet para mapas
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Bar } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { RondasPorVigilador, RegistroReporte } from '../types'; // ← Import tipos DRY

interface DashboardProps {
  servicioId: string; // Del login JWT (context/auth hook)
}

const DashboardPage: React.FC<DashboardProps> = ({ servicioId }) => {
  const { data, isLoading, error } = useQuery<RondasPorVigilador, Error>({
    queryKey: ['reportes', servicioId],
    queryFn: () => api.get(`/api/reportes/rondas?servicioId=${servicioId}`).then(res => res.data),
  });

  if (isLoading) return <div className="text-center py-10">Cargando reportes...</div>;
  if (error) return <div className="text-red-500">Error: {error.message}</div>;

  // Gráfico: Rondas por vigilador (type-safe)
  const chartData = {
    labels: Object.keys(data ?? {}),
    datasets: [{ label: 'Rondas completas', data: Object.values(data ?? {}).map(ronda => ronda.length), backgroundColor: '#1e40af' }],
  };

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold mb-6">Dashboard de Monitoreo - Servicio {servicioId}</h1>
      
      {/* Tabla de Registros (type-safe iteration) */}
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4">Vigilador</th>
              <th className="py-2 px-4">Punto</th>
              <th className="py-2 px-4">Timestamp</th>
              <th className="py-2 px-4">Geo</th>
              <th className="py-2 px-4">Novedades</th>
              <th className="py-2 px-4">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data ?? {}).flatMap(([vigId, rondas]: [string, RegistroReporte[]]) =>
              rondas.map((reg: RegistroReporte, idx: number) => (
                <tr key={`${vigId}-${idx}`} className="border-t">
                  <td className="py-2 px-4">{vigId}</td>
                  <td className="py-2 px-4">{reg.punto}</td>
                  <td className="py-2 px-4">{reg.timestamp}</td>
                  <td className="py-2 px-4">{reg.geo ? `${reg.geo.lat}, ${reg.geo.long}` : 'N/A'}</td>
                  <td className="py-2 px-4">{reg.novedades ?? 'Ninguna'}</td>
                  <td className="py-2 px-4 text-red-500">{reg.alerta ?? 'OK'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Gráfico Chart.js */}
      <div className="mb-8">
        <Bar data={chartData} options={{ responsive: true, scales: { y: { beginAtZero: true } } }} />
      </div>
      {/* Mapa Geo (últimos registros) */}
      <div className="h-64">
        <MapContainer center={[-34.5467, -58.4596]} zoom={15} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {Object.values(data ?? {}).flat().map((reg: RegistroReporte, idx: number) =>
            reg.geo && <Marker key={idx} position={[reg.geo.lat, reg.geo.long]} />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default DashboardPage;