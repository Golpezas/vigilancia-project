// src/components/AdminLogin.tsx
// Login Admin con validación Zod, error handling Axios y UX moderna (2026 best practices: no hardcode, dynamic errors)

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
  onBack: () => void;  // Prop para volver a modo vigilador
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onError, onBack }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdminValues>({
    resolver: zodResolver(AdminSchema),
    defaultValues: { email: 'admin@pruebas.com' },
  });

  const onSubmit = async (data: AdminValues) => {
    try {
      const res = await api.post('/api/auth/login', data);  // Ruta corregida (match backend)

      // Validación estricta con narrowing
      if (typeof res.data.token !== 'string') {
        throw new Error('Respuesta inválida: token ausente');
      }
      if (res.data.role?.toUpperCase() !== 'ADMIN') {
        throw new Error('Acceso denegado: rol no autorizado');
      }

      onSuccess(res.data.token);
    } catch (err: unknown) {
      let message = 'Error al iniciar sesión';
      if (isAxiosError(err)) {
        message = err.response?.data.error || 'Credenciales inválidas';
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

      {/* Botón Volver - Siempre visible */}
      <button
        onClick={onBack}
        className="w-full mt-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition"
      >
        Volver a Modo Vigilador
      </button>
    </div>
  );
};