// src/components/AdminLogin.tsx
// Login Admin con validación Zod para inputs y respuesta API, normalización de ruta y UX moderna (2026 best practices: runtime validation, data normalization, fallback structures)

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

// Schema para inputs (normalizado y estricto)
const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

// Schema para respuesta del backend (runtime validation + transformación/normalización)
const LoginResponseSchema = z.object({
  token: z.string().min(20, 'Token inválido o ausente'),
  role: z.string().optional(),
}).transform((val) => ({
  token: val.token,
  role: val.role?.toUpperCase() || 'ADMIN', // Normalización fallback (asume ADMIN si no viene, para prod ajusta)
}));

interface AdminLoginProps {
  onSuccess: (token: string) => void;
  onError: (err: string) => void;
  onBack: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onError, onBack }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdminValues>({
    resolver: zodResolver(AdminSchema),
    defaultValues: { email: 'admin@pruebas.com' },
  });

  const onSubmit = async (data: AdminValues) => {
    try {
      const BACKEND_URL = 'https://backend-production-d4731.up.railway.app';

      // Ruta normalizada con prefijo completo (best practice: estructura configurable)
      const endpoints = [
        '/api/auth/login',  // Primera tentativa: con /api/
        '/auth/login',      // Fallback: sin /api/ (basado en log anterior que funcionó)
      ];

      let response;
      
      for (const path of endpoints) {
        try {
          response = await axios.post(
            `${BACKEND_URL}${path}`,
            data,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000,
            }
          );
          break; // Sale si tiene éxito
        } catch (innerErr) {
          if (!axios.isAxiosError(innerErr) || innerErr.response?.status !== 404) {
            throw innerErr; // Si no es 404, re-lanza error real
          }
          console.warn(`[Auth Fallback] 404 en ${path}, intentando siguiente...`);
        }
      }

      if (!response) {
        throw new Error('Todas las rutas fallaron: servidor no responde en endpoints esperados');
      }

      // Validación y normalización con Zod (type-safe, evita errores en data cruda)
      const parsed = LoginResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        const errorDetails = parsed.error.format();
        throw new Error(
          errorDetails.token?._errors?.[0] ||
          errorDetails._errors?.[0] ||
          'Respuesta inválida del servidor'
        );
      }

      const { token, role } = parsed.data;

      // Chequeo de rol (normalizado, con fallback si no viene)
      if (role !== 'ADMIN') {
        throw new Error('Acceso denegado: rol no autorizado');
      }

      onSuccess(token);

    } catch (err: unknown) {
      let message = 'Error al iniciar sesión';

      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error ||
                  err.response?.data?.message ||
                  err.message ||
                  'Error de conexión o credenciales inválidas';
      } else if (err instanceof Error) {
        message = err.message;
      }

      onError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10 p-8 bg-gray-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Iniciar Sesión Admin</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="admin@pruebas.com"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          {errors.email && <p className="text-red-400 mt-2 text-sm">{errors.email.message}</p>}
        </div>

        <div>
          <input
            {...register('password')}
            type="password"
            placeholder="Contraseña"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          {errors.password && <p className="text-red-400 mt-2 text-sm">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:opacity-50"
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesión Admin'}
        </button>
      </form>

      <button
        onClick={onBack}
        className="w-full mt-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition"
      >
        Volver a Modo Vigilador
      </button>
    </div>
  );
};