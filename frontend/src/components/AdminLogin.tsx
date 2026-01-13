import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../services/api';
import { isAxiosError } from 'axios'; // ← IMPORT CRUCIAL

const AdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type AdminValues = z.infer<typeof AdminSchema>;

interface AdminLoginProps {
  onSuccess: (token: string) => void;
  onError: (err: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onError }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<AdminValues>({
    resolver: zodResolver(AdminSchema),
  });

  const onSubmit = async (data: AdminValues) => {
    try {
      const res = await api.post('/auth/login', data);
      if (res.data.role !== 'ADMIN') {
        throw new Error('Rol no autorizado');
      }
      onSuccess(res.data.token);
    } catch (err: unknown) { // ← unknown es correcto
      let message = 'Error de login';
      if (isAxiosError(err)) {
        message = err.response?.data?.error || err.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      onError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md mx-auto mt-10">
      <input {...register('email')} placeholder="Email admin" className="w-full p-3 border rounded" />
      {errors.email && <p className="text-red-500">{errors.email.message}</p>}

      <input type="password" {...register('password')} placeholder="Contraseña" className="w-full p-3 border rounded" />
      {errors.password && <p className="text-red-500">{errors.password.message}</p>}

      <button type="submit" className="w-full py-3 bg-red-600 text-white rounded">Iniciar sesión Admin</button>
    </form>
  );
};