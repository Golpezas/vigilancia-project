// src/types/express.d.ts  ← asegúrate que el path sea correcto

import { TokenPayload } from '../services/authService'; // o tu tipo real

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;  // o tu interfaz exacta { id: string; email: string; role: 'ADMIN' | 'CLIENT' }
  }
}

export {};