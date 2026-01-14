// scripts/crear-admin.ts
import { prisma } from '../src/repositories/vigiladorRepository';
import bcrypt from 'bcryptjs';

async function crearAdmin() {
  const email = 'admin@pruebas.com';
  const passwordPlano = 'Admin.2026!'; // CAMBIA ESTO

  const password = await bcrypt.hash(passwordPlano, 12);

  try {
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        password,
        role: 'ADMIN',
      },
      create: {
        email,
        password,
        role: 'ADMIN',
      },
    });

    console.log('¡Administrador creado/existente!');
    console.log('Email:', admin.email);
    console.log('Rol:', admin.role);
    console.log('Usa esta contraseña para login:', passwordPlano);
  } catch (error) {
    console.error('Error al crear admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

crearAdmin();