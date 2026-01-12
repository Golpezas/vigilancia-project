// backend/src/types/express.d.ts
// Augmentación oficial de Express para req.user
// Compatible con el TokenPayload real que usamos en authService

import { TokenPayload } from '../services/authService'; // Importamos el tipo exacto

declare module 'express-serve-static-core' {
  interface Request {
    /**
     * Usuario autenticado vía JWT (disponible después del middleware)
     * Tipado estricto según el payload que firmamos
     */
    user?: TokenPayload;
  }
}

export {};