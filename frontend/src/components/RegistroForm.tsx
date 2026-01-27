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
        const uuid = uuidv4();

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

        // Validación local de duplicados pendientes
        const duplicadosLocales = await db.registros
          .where('legajo')
          .equals(registro.legajo)
          .filter((r) => r.punto === punto && r.synced === 0)
          .toArray();

        if (duplicadosLocales.length > 0) {
          const errMsg = 'Este punto ya fue registrado en esta ronda (pendiente de sincronización).';
          console.warn('[VALIDACIÓN LOCAL] Duplicado detectado:', duplicadosLocales.length);
          throw new Error(errMsg);
        }

        // Guardado local comentado temporalmente
        // await db.registros.put(registro);
        // console.log('💾 Registro guardado localmente', { uuid });

        if (!navigator.onLine) {
          onError('Sin conexión a internet. El registro no se pudo enviar en este momento.');
          return;
        }

        console.log('[DEBUG] Intentando envío inmediato', { uuid, punto });

        const response = await api.post('/submit-batch', { registros: [registro] });

        console.log('[SYNC] Respuesta recibida:', response.status, response.data);

        // Validación de la respuesta con Zod
        const ResponseSchema = z.object({
          success: z.boolean(),
          syncedUuids: z.array(z.string()).optional(),
          results: z.array(
            z.object({
              uuid: z.string(),
              success: z.boolean(),
              mensaje: z.string().optional(),
            })
          ).optional(),
          summary: z.string().optional(),
          message: z.string().optional(),
        });

        const parsed = ResponseSchema.safeParse(response.data);
        if (!parsed.success) {
          console.warn('[RESPONSE INVALIDA]', parsed.error.issues);
          throw new Error('Respuesta del servidor no válida');
        }

        if (!parsed.data.success) {
          throw new Error(parsed.data.message || 'El servidor rechazó el registro');
        }

        // Extraer mensaje de éxito
        let successMsg = 'Registro enviado exitosamente';

        if (parsed.data.results && parsed.data.results.length > 0) {
          const first = parsed.data.results[0];
          if (first.success && first.mensaje) {
            successMsg = first.mensaje;
          } else if (!first.success && first.mensaje) {
            throw new Error(first.mensaje);
          }
        } else if (parsed.data.message) {
          successMsg = parsed.data.message;
        }

        // Enriquecimiento simple del mensaje
        if (successMsg.includes('completada') || successMsg.includes('100%') || successMsg.includes('finalizada')) {
          successMsg = `🎉 ${successMsg}\n¡Excelente trabajo!`;
        }

        console.log('[ÉXITO] Mensaje a mostrar:', successMsg);
        onSuccess(successMsg);

      } catch (err: unknown) {
        console.error('[ERROR EN ENVÍO]', err);

        let userMessage = 'Ocurrió un error al enviar el registro. Intenta nuevamente.';

        if (isAxiosError(err) && err.response) {
          const { status, data } = err.response;

          if (status === 400 && data?.error && typeof data.error === 'string') {
            userMessage = data.error;  // Mensaje directo del backend (ej: "Inconsistencia en orden...")
          } else if (status >= 500) {
            userMessage = 'Error en el servidor. Intenta más tarde.';
          } else if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
            userMessage = 'La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.';
          }
        } else if (err instanceof Error) {
          userMessage = err.message;
        }

        console.log('[ERROR] Mensaje que se mostrará al usuario:', userMessage);
        onError(userMessage);

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