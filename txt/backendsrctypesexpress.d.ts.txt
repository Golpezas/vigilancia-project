// src/types/express.d.ts
// Augmentación de tipos Express - Mejores prácticas 2026: Declaration merging para propiedades custom en Request
// Type-safety total, reusable en toda la app

import { JwtPayload } from 'jsonwebtoken'; // Opcional: para tipar mejor el payload

declare global {
  namespace Express {
    interface Request {
      user?: {
        servicioId: string;
        userId: string;
        // Agrega más campos del JWT si lo expandís (e.g., role: string)
      };
    }
  }
}

export {}; // Asegura que sea un módulo (importante para TS)