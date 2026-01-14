// src/components/AdminLogin.tsx
// Versión simplificada y robusta: axios directo con URL absoluta (probada en logs), validación mínima, sin dependencias de api.ts

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

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
      // URL absoluta probada y funcional según logs anteriores
      const response = await axios.post(
        'https://backend-production-d4731.up.railway.app/auth/login', // <--- Ruta que funcionó
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      // Validación mínima para token (Zod para normalización)
      const token = response.data.token;
      if (!token || typeof token !== 'string' || token.length < 20) {
        throw new Error('Token inválido o ausente en la respuesta');
      }

      // ¡Éxito! Pasamos el token limpio
      onSuccess(token);

    } catch (err) {
      let message = 'Error al iniciar sesión';

      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error 
          || err.response?.data?.message 
          || err.message 
          || 'Ruta no encontrada o credenciales inválidas';
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