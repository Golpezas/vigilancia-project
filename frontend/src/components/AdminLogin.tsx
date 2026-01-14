// src/components/AdminLogin.tsx
// Versión simplificada para regreso al punto funcional: URL absoluta, sin chequeo de rol, validación mínima Zod para token

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

// Schema para inputs
const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

// Schema para respuesta (solo valida token, sin role para evitar errores)
const LoginResponseSchema = z.object({
  token: z.string().min(20, 'Token inválido o ausente'),
});

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
        `${BACKEND_URL}/auth/login`, // Ruta que funcionó en logs anteriores (sin /api/)
        data,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );

      // Validación mínima con Zod (solo token)
      const parsed = LoginResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new Error('Respuesta inválida: token ausente o inválido');
      }

      onSuccess(parsed.data.token);

    } catch (err: unknown) {
      let message = 'Error al iniciar sesión';

      if (axios.isAxiosError(err)) {
        message = err.response?.data?.error || 'Ruta no encontrada o credenciales inválidas';
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