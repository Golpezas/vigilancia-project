// src/components/RegistroForm.tsx
import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
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
        const uuid = uuidv4(); // Generado una vez

        const registro = {
          nombre: values.nombre.trim(),
          legajo: values.legajo,
          punto,
          novedades: values.novedades?.trim() ?? undefined,
          timestamp: new Date().toISOString(),
          geo: geo.lat && geo.long ? { lat: geo.lat, long: geo.long } : undefined,
          uuid,
          createdAt: new Date().toISOString(),
          synced: 0,
        };

        // Validación local: ¿ya existe este punto en ronda activa? (IndexedDB)
        const duplicadosLocales = await db.registros
          .where('legajo')
          .equals(registro.legajo)
          .filter((r) => r.punto === punto && r.synced === 0) // Solo pendientes (ronda activa)
          .toArray();

        if (duplicadosLocales.length > 0) {
          throw new Error('Este punto ya fue registrado en esta ronda (pendiente de sync).');
        }

        // Siempre guardar localmente (offline-first)
        await db.registros.put(registro);
        console.log('💾 Registro guardado localmente', { uuid });

        let successMessage = 'Registro guardado localmente. Se sincronizará automáticamente cuando haya conexión.';

        if (navigator.onLine) {
          console.log('[DEBUG] Intentando sync inmediato (online detectado)');
          try {
            const response = await api.post('/submit-batch', { registros: [registro] });

            console.log('[SYNC SUCCESS] Respuesta backend:', {
              status: response.status,
              data: response.data,
            });

            if (response.data.success) {
              // Marcar como sincronizado
              await db.registros.where('uuid').equals(registro.uuid).modify({ synced: 1 });
              successMessage = response.data.message || 'Registro enviado exitosamente al servidor';
            } else {
              // Rechazo del backend (ej: duplicado o secuencia) → no marcar synced, mostrar error y dejar pendiente
              const backendError = response.data.error || response.data.message || 'Rechazado por el servidor';
              throw new Error(backendError);
            }
          } catch (syncError: unknown) {
              console.error('[SYNC ERROR] Detalle:', syncError);

              let errMsg = 'Error desconocido';
              let code: string | undefined;
              let responseStatus: number | undefined;

              if (isAxiosError(syncError) && syncError.response) {
                const { data, status } = syncError.response;
                responseStatus = status;

                if (status === 400 && data.error) {
                  errMsg = data.error; // e.g., 'Siguiente punto esperado: 3...'
                  // Error lógico: NO activa offline, borra local si ya guardado
                  await db.registros.where('uuid').equals(registro.uuid).delete();
                  console.log('[ERROR LÓGICO] Borrado local - mostrando mensaje backend');
                  onError(errMsg); // Muestra directo
                  return; // Sale del catch sin fallback offline
                } else if (status >= 500 || code === 'ECONNABORTED') {
                  errMsg = 'Error de red/servidor - modo offline activado';
                  // Deja pendiente
                }
              }

              // Diferencia errores lógicos (online) vs red (offline)
              let displayMsg = errMsg;
              const isNetworkError = errMsg.toLowerCase().includes('timeout') || code === 'ECONNABORTED' || (responseStatus !== undefined && responseStatus >= 500);

              if (isNetworkError) {
                displayMsg = 'Sin conexión: Registro guardado localmente. Se sincronizará después.';
                // Deja pendiente
              } else {
                // Error lógico (e.g., secuencia 400): Borra local + muestra mensaje backend
                await db.registros.where('uuid').equals(registro.uuid).delete();
                console.log('[ERROR LÓGICO] Registro local borrado - no synced por validación');
                displayMsg = errMsg; // e.g., "Debes escanear el punto 3..."
              }

              onError(displayMsg); // o onSuccess si quieres diferenciar
            }
        } else {
          console.log('[OFFLINE] Sin conexión detectada - modo local puro');
        }

        onSuccess(successMessage);
      } catch (error: unknown) {
        // Tu manejo de errores original completo (intacto)
        let errMsg = 'Error desconocido';
        let code: string | undefined;
        let responseData: unknown;
        let responseStatus: number | undefined;

        if (error instanceof Error) errMsg = error.message;

        if (isAxiosError(error) && error.response) {
          const { data, status } = error.response;
          code = error.code;
          responseData = data;
          responseStatus = status;

          if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
            errMsg = data.error;
          } else {
            errMsg = `Error del servidor (código ${status})`;
          }
        }

        let displayMsg = errMsg;
        if (errMsg.includes('no pertenece') || errMsg.includes('siguiente') || errMsg.includes('Inicia la ronda')) {
          displayMsg = errMsg;
        } else if (errMsg.toLowerCase().includes('timeout') || code === 'ECONNABORTED') {
          displayMsg = 'Timeout: Verifica tu conexión e intenta nuevamente';
        } else if (responseStatus === 500) {
          displayMsg = 'Error interno del servidor. Intenta más tarde.';
        }

        console.error('❌ Error en submit:', {
          originalMessage: errMsg,
          code,
          status: responseStatus,
          response: responseData,
          stack: error instanceof Error ? error.stack : undefined,
        });

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