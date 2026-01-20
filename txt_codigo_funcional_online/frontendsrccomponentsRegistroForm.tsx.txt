// src/components/RegistroForm.tsx
import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import { z } from 'zod';
import { isAxiosError } from 'axios'; // ← Necesario para axios.isAxiosError
import api from '../services/api';
import type { ApiResponse } from '../types';

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
      try {
        console.log('📤 Iniciando submit:', {
          nombre: values.nombre.trim(),
          legajo: values.legajo,
          punto,
          novedades: values.novedades?.trim(),
          timestamp: new Date().toISOString(),
          geo,
        });

        const response = await api.post<ApiResponse>('/submit', {
          nombre: values.nombre.trim(),
          legajo: values.legajo,
          punto,
          novedades: values.novedades?.trim(),
          timestamp: new Date().toISOString(),
          geo,
        });

        console.log('✅ Respuesta exitosa:', response.data);

        if (response.data.success) {
          onSuccess(response.data.mensaje || 'Registro enviado');
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      } catch (error: unknown) {
        // Inicialización normalizada de variables (best practice: evita undefineds)
        let errMsg = 'Error desconocido'; // Fallback base
        let code: string | undefined = undefined;
        let responseData: unknown = undefined;
        let responseStatus: number | undefined = undefined;

        // Narrowing exhaustivo y type-safe para error genérico
        if (error instanceof Error) {
          errMsg = error.message;
        }

        // Chequeo específico para AxiosError (usa isAxiosError para narrowing automático)
        if (isAxiosError(error) && error.response) {
          // TS ahora infiere que error es AxiosError con response
          const { data, status } = error.response;
          code = error.code; // e.g., 'ECONNABORTED' para timeouts
          responseData = data; // Podría ser { error: string } u otro
          responseStatus = status; // e.g., 400, 403, 500

          // Normalización del mensaje del backend (DRY: un solo lugar para chequeos)
          if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
            errMsg = data.error; // Usa directamente el error del backend si existe
          } else {
            errMsg = `Error del servidor (código ${status})`; // Fallback genérico con status
          }
        }

        // Lógica de mensajes personalizados (integra tus chequeos aquí para evitar duplicación)
        let displayMsg = errMsg; // Normalizado para UX
        if (errMsg.includes('no pertenece') || errMsg.includes('siguiente') || errMsg.includes('Inicia la ronda')) {
          displayMsg = errMsg; // Muestra mensaje claro del backend sin cambios
        } else if (errMsg.toLowerCase().includes('timeout') || code === 'ECONNABORTED') {
          displayMsg = 'Timeout: Verifica tu conexión e intenta nuevamente';
        } else if (responseStatus === 500) {
          displayMsg = 'Error interno del servidor. Intenta más tarde.';
        } // Agrega más status si necesitas (e.g., 401 para auth)

        // Logging estructurado (mejor práctica: objeto JSON para traceabilidad)
        console.error('❌ Error en submit:', {
          originalMessage: errMsg,
          code,
          status: responseStatus,
          response: responseData,
          stack: error instanceof Error ? error.stack : undefined, // Opcional para dev
        });

        // Llama a onError con el mensaje normalizado y amigable para el usuario
        onError(displayMsg);
      } finally {
        setSubmitting(false); // Siempre ejecuta (best practice: evita submits stuck)
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