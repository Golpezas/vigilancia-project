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
  onBack: () => void;  // ← Nueva prop para volver
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onError, onBack }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminValues>({
    resolver: zodResolver(AdminSchema),
    defaultValues: { email: 'admin@pruebas.com' },
  });

  const onSubmit = async (data: AdminValues) => {
    try {
      const res = await api.post('/api/auth/login', data);  // ← Ruta completa normalizada (match backend)

      const token = res.data.token;
      const role = res.data.role?.toUpperCase();

      if (!token) throw new Error('Respuesta sin token');
      if (role !== 'ADMIN') throw new Error('Rol no autorizado');

      onSuccess(token);
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? err.response?.data?.error || 'Credenciales inválidas'
        : (err as Error).message || 'Error desconocido';
      onError(msg);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-gray-800 rounded-xl shadow-xl">
      {/* Removemos mensaje fijo de "Acceso denegado" - lo manejamos con error prop */}
      <h2 className="text-2xl font-bold text-white mb-6 text-center">
        Iniciar Sesión Admin
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input
          {...register('email')}
          type="email"
          placeholder="admin@pruebas.com"
          className="w-full p-4 bg-gray-700 text-white border border-gray-600 rounded-lg focus:border-blue-500 outline-none"
        />
        {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}

        <input
          {...register('password')}
          type="password"
          placeholder="Contraseña"
          className="w-full p-4 bg-gray-700 text-white border border-gray-600 rounded-lg focus:border-blue-500 outline-none"
        />
        {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Iniciando...' : 'Iniciar sesión Admin'}
        </button>
      </form>

      {/* Botón para regresar - NUEVO */}
      <button
        onClick={onBack}
        className="w-full mt-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition"
      >
        Volver a Modo Vigilador
      </button>
    </div>
  );
};