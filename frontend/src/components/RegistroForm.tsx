// src/components/RegistroForm.tsx
import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid'; // ← Importamos uuid v4 (instalado en frontend)
import api from '../services/api';
import { db } from '../db/offlineDb';

const FormSchema = z.object({
  nombre: z.string().min(3, 'Nombre muy corto'),
  legajo: z.coerce.number().int().positive('Legajo debe ser positivo'),
  novedades: z.string().optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface RegistroFormProps {
  punto: number;
  onSuccess: (mensaje: string) => void;
  onError: (error: string) => void;
  onBack: () => void;
}

export const RegistroForm: React.FC<RegistroFormProps> = ({
  punto,
  onSuccess,
  onError,
  onBack,
}) => {
  const [geo, setGeo] = useState<{ lat: number | null; long: number | null }>({
    lat: null,
    long: null,
  });
  const [loadingGeo, setLoadingGeo] = useState(true);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeo({
            lat: position.coords.latitude,
            long: position.coords.longitude,
          });
          setLoadingGeo(false);
        },
        (err) => {
          console.warn('Error de geolocalización:', err.message);
          setGeo({ lat: null, long: null });
          setLoadingGeo(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      setLoadingGeo(false);
    }
  }, []);

  const formik = useFormik<FormValues>({
    initialValues: {
      nombre: '',
      legajo: 0,
      novedades: '',
    },
    validate: (values) => {
      const result = FormSchema.safeParse(values);
      if (!result.success) {
        return result.error.flatten().fieldErrors;
      }
      return {};
    },
    onSubmit: async (values, { setSubmitting }) => {
      setSubmitting(true);

      try {
        // Generamos UUID UNA SOLA VEZ por submit
        const uuid = uuidv4();

        const registro = {
          nombre: values.nombre.trim(),
          legajo: values.legajo,
          punto,
          novedades: values.novedades?.trim() ?? undefined,
          timestamp: new Date().toISOString(),
          geo: geo.lat && geo.long ? { lat: geo.lat, long: geo.long } : undefined,
          uuid, // ← UUID generado aquí (idempotencia garantizada)
          createdAt: new Date().toISOString(),
          synced: 0,
        };

        console.log('📤 Preparando registro con UUID:', {
          uuid: registro.uuid,
          punto,
          legajo: registro.legajo,
          timestamp: registro.timestamp,
        });

        // Siempre guardar localmente primero (offline-first)
        await db.registros.put(registro);
        console.log('💾 Registro guardado localmente (IndexedDB)', { uuid: registro.uuid });

        let successMessage = 'Registro guardado localmente. Se sincronizará automáticamente cuando haya conexión.';

        // Intentar sincronización inmediata si está online
        if (navigator.onLine) {
          console.log('[SYNC] Intentando envío inmediato al backend');
          try {
            const response = await api.post('/submit-batch', {
              registros: [registro],
            });

            console.log('[SYNC SUCCESS]', {
              status: response.status,
              data: response.data,
            });

            if (response.data.success) {
              // Marcar como sincronizado (usa 1 en lugar de true para consistencia numérica)
              await db.registros.where('uuid').equals(registro.uuid).modify({ synced: 1 });
              successMessage = response.data.message || 'Registro enviado y confirmado por el servidor';
            } else {
              throw new Error(response.data.error || 'Respuesta inválida del servidor');
            }
          } catch (syncError: unknown) {
            console.error('[SYNC ERROR]', syncError);
            let displayMsg = 'Error al sincronizar con el servidor. El registro queda guardado localmente y se reintentará.';

            if (isAxiosError(syncError) && syncError.response) {
              const { data, status } = syncError.response;
              if (status === 400 || status === 403) {
                // Errores de validación/secuencia del backend → mostramos mensaje claro
                displayMsg = (data as Record<string, unknown>)?.error as string || displayMsg;
              }
            }

            onError(displayMsg);
            // No lanzamos error fatal: el registro ya está guardado localmente
          }
        } else {
          console.log('[OFFLINE] Registro solo local - sync pendiente');
        }

        onSuccess(successMessage);
      } catch (error: unknown) {
        let displayMsg = 'Error al procesar el registro. Intenta nuevamente.';
        if (error instanceof Error) {
          displayMsg = error.message;
        }
        console.error('❌ Error crítico en submit:', error);
        onError(displayMsg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">Registro Punto {punto}</h2>

      <form onSubmit={formik.handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nombre completo</label>
          <input
            type="text"
            name="nombre"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.nombre}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Juan Pérez"
            autoFocus
          />
          {formik.touched.nombre && formik.errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{formik.errors.nombre}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Legajo</label>
          <input
            type="number"
            name="legajo"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.legajo}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="12345"
          />
          {formik.touched.legajo && formik.errors.legajo && (
            <p className="text-red-500 text-sm mt-1">{formik.errors.legajo}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Novedades (opcional)</label>
          <textarea
            name="novedades"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.novedades ?? ''}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Todo en orden, sin novedades..."
          />
        </div>

        <div className="mb-6 text-sm">
          <span className="font-medium">Geolocalización: </span>
          {loadingGeo ? (
            <span className="text-gray-500">Obteniendo ubicación...</span>
          ) : geo.lat && geo.long ? (
            <span className="text-green-600">Capturada ✓</span>
          ) : (
            <span className="text-orange-600">No disponible (se enviará sin coordenadas)</span>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
          >
            Volver a escanear
          </button>
          <button
            type="submit"
            disabled={formik.isSubmitting || loadingGeo}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formik.isSubmitting ? 'Enviando...' : 'Enviar registro'}
          </button>
        </div>
      </form>
    </div>
  );
};