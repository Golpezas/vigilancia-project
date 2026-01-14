// src/components/AdminLogin.tsx
// Versión final: validación Zod estricta para respuesta, chequeo de rol opcional/comentado, normalización data

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

// Schema inputs (ya perfecto)
const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

// Schema para respuesta del backend (runtime validation + transformación)
const LoginResponseSchema = z.object({
  token: z.string().min(20, 'Token inválido o ausente'),
  // role: opcional por ahora (el backend no lo envía visiblemente)
  role: z.string().optional(),
}).transform((val) => ({
  token: val.token,
  role: val.role?.toUpperCase() || 'UNKNOWN', // fallback normalizado
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

      const response = await axios.post(
        `${BACKEND_URL}/auth/login`,
        data,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      // Validamos y normalizamos la respuesta con Zod
      const parsed = LoginResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        const errorDetails = parsed.error.format();
        throw new Error(
          errorDetails.token?._errors?.[0] ||
          errorDetails._errors?.[0] ||
          'Respuesta inválida del servidor'
        );
      }

      const { token } = parsed.data;

      // Chequeo de rol comentado temporalmente (descomentar cuando backend lo incluya)
      // if (parsed.data.role !== 'ADMIN') {
      //   throw new Error('Acceso denegado: rol no autorizado');
      // }

      // ¡Éxito! Pasamos el token limpio
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
    <div className="w-full max-w-md mx-auto mt-10 p-8 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-8 text-center">Iniciar Sesión Admin</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="admin@pruebas.com"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          {errors.email && <p className="text-red-400 mt-2 text-sm">{errors.email.message}</p>}
        </div>

        <div>
          <input
            {...register('password')}
            type="password"
            placeholder="Contraseña"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 
                       focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          {errors.password && <p className="text-red-400 mt-2 text-sm">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 
                     hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg 
                     transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesión Admin'}
        </button>
      </form>

      <button
        onClick={onBack}
        className="w-full mt-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
      >
        Volver a Modo Vigilador
      </button>
    </div>
  );
};