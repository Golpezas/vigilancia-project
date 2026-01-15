// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

// Configuración recomendada 2026: staleTime razonable + retry inteligente
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 minutos → buen balance prod
      gcTime: 1000 * 60 * 10,       // garbage collect después de 10 min
      retry: 2,                     // reintenta 2 veces en errores transitorios
      refetchOnWindowFocus: false,  // evita refetch innecesario al volver a la pestaña
      refetchOnReconnect: false,
    },
  },
});