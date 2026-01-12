// src/components/LoginForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '../services/api';

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type LoginValues = z.infer<typeof LoginSchema>;

interface LoginFormProps {
  onSuccess: (token: string) => void;
  onError: (err: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
  });

  const onSubmit = async (data: LoginValues) => {
    try {
      const response = await api.post('/auth/login', data);
      onSuccess(response.data.token);
    } catch {
      onError('Login fallido: credenciales inválidas');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input {...register('email')} placeholder="Email" className="w-full p-2 border rounded" />
      {errors.email && <p className="text-red-500">{errors.email.message}</p>}
      
      <input type="password" {...register('password')} placeholder="Contraseña" className="w-full p-2 border rounded" />
      {errors.password && <p className="text-red-500">{errors.password.message}</p>}
      
      <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded">Iniciar sesión</button>
    </form>
  );
};