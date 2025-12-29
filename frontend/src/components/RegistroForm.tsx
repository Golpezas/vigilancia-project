// src/components/RegistroForm.tsx
import React, { useState, useEffect } from 'react';
import { useFormik } from 'formik';
import { z } from 'zod';
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

export const RegistroForm: React.FC<RegistroFormProps> = ({ punto, onSuccess, onError, onBack }) => {
  const [geo, setGeo] = useState<{ lat: number | null; long: number | null }>({ lat: null, long: null });
  const [loadingGeo, setLoadingGeo] = useState(true);

  useEffect(() => {
    const getLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGeo({
              lat: position.coords.latitude,
              long: position.coords.longitude,
            });
          },
          (err) => {
            console.warn('Geolocalización denegada o error:', err);
            setGeo({ lat: null, long: null });
          },
          { timeout: 10000 }
        );
      }
      setLoadingGeo(false);
    };

    getLocation();
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
        const response = await api.post<ApiResponse>('/submit', {
          nombre: values.nombre.trim(),
          legajo: values.legajo,
          punto,
          novedades: values.novedades?.trim(),
          timestamp: new Date().toISOString(),
          geo,
        });

        if (response.data.success) {
          onSuccess(response.data.mensaje || 'Punto registrado correctamente');
        } else {
          onError(response.data.error || 'Respuesta inesperada del servidor');
        }
      } catch (err) {
        const msg = err instanceof Error 
          ? err.message 
          : 'Error de conexión con el servidor';
        onError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center mb-6">Punto {punto}</h2>
      <form onSubmit={formik.handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nombre completo</label>
          <input
            type="text"
            name="nombre"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.nombre}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Juan Pérez"
          />
          {formik.touched.nombre && formik.errors.nombre && (
            <p className="text-red-500 text-sm mt-1">{formik.errors.nombre as string}</p>
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
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="12345"
          />
          {formik.touched.legajo && formik.errors.legajo && (
            <p className="text-red-500 text-sm mt-1">{formik.errors.legajo as string}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Novedades (opcional)</label>
          <textarea
            name="novedades"
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            value={formik.values.novedades ?? ''}
            rows={3}
            className="w-full px-4 py-2 border rounded-lg"
            placeholder="Todo en orden..."
          />
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Geolocalización: {loadingGeo ? 'Obteniendo...' : geo.lat ? 'Capturada' : 'No disponible'}
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={onBack} className="flex-1 py-3 bg-gray-500 text-white rounded-lg font-medium">
            Volver a escanear
          </button>
          <button
            type="submit"
            disabled={formik.isSubmitting || loadingGeo}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {formik.isSubmitting ? 'Enviando...' : 'Enviar registro'}
          </button>
        </div>
      </form>
    </div>
  );
};