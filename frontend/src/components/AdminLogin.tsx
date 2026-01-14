// src/components/AdminLogin.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../services/api';
import { isAxiosError } from 'axios';

const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

interface AdminLoginProps {
  onSuccess: (token: string) => void;
  onError: (err: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onError }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminValues>({
    resolver: zodResolver(AdminSchema),
    defaultValues: {
      email: 'admin@pruebas.com',
    },
  });

  const onSubmit = async (data: AdminValues) => {
    try {
      const res = await api.post('/auth/login', data); // ← ¡Aquí está la ruta correcta!

      const token = res.data.token;
      const role = res.data.role?.toUpperCase();

      if (!token) {
        throw new Error('No se recibió token en la respuesta');
      }

      if (role !== 'ADMIN') {
        throw new Error('Acceso denegado: solo administradores');
      }

      onSuccess(token); // ← ¡Llamada crítica que faltaba!
    } catch (err: unknown) {
      let message = 'Error al iniciar sesión';

      if (isAxiosError(err)) {
        message =
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Credenciales inválidas o error de servidor';
      } else if (err instanceof Error) {
        message = err.message;
      }

      onError(message);
      console.error('[AdminLogin] Error completo:', err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-10 p-8 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
      <h2 className="text-2xl font-bold text-center text-white mb-8">
        Iniciar sesión Admin
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <input
            {...register('email')}
            type="email"
            placeholder="admin@pruebas.com"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          {errors.email && (
            <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <input
            {...register('password')}
            type="password"
            placeholder="Contraseña"
            className="w-full p-4 bg-gray-700 text-white rounded-lg border border-gray-600 
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          {errors.password && (
            <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 
                   text-white font-bold rounded-lg transition-all disabled:opacity-50 
                   disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesión Admin'}
        </button>
      </form>
    </div>
  );
};