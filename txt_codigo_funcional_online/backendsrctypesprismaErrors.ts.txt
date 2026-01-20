// src/types/prismaErrors.ts
export interface PrismaKnownError extends Error {
  code?: string;
  meta?: Record<string, unknown>;
  clientVersion?: string;
  // Puedes extender con más campos si los usas frecuentemente
}

export function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof (err as any).code === 'string' &&
    (err as any).code.startsWith('P') // Todos los códigos Prisma comienzan con P
  );
}