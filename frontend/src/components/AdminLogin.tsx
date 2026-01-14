// src/components/AdminLogin.tsx
// Login Admin con validación Zod, error handling Axios y UX moderna (2026 best practices: no hardcode, dynamic errors)

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
//import api from '../services/api';
//import { isAxiosError } from 'axios';
import axios from 'axios';

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
      // URL ABSOLUTA - cámbiala por tu URL REAL de Railway
      const BACKEND_URL = 'https://backend-production-d4731.up.railway.app';

      console.log('Intentando login directo a:', `${BACKEND_URL}/auth/login`);

      const response = await axios.post(
        `${BACKEND_URL}/auth/login`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      console.log('Respuesta recibida:', response.status, response.data);

      const token = response.data.token;
      if (!token || typeof token !== 'string') {
        throw new Error('No se recibió token válido en la respuesta');
      }

      // Validación de rol (opcional pero recomendado)
      if (response.data.role?.toUpperCase() !== 'ADMIN') {
        throw new Error('Acceso denegado: solo administradores');
      }

      onSuccess(token);

    } catch (err) {
      let message = 'Error al iniciar sesión';

      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error 
          || err.response?.data?.message 
          || 'Error de conexión o credenciales inválidas';
        console.error('Detalles del error Axios:', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
      } else {
        message = (err as Error).message || 'Error desconocido';
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