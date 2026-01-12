// src/routes/vigiladorRoutes.ts

import { Router } from 'express';
import { VigiladorController } from '../controllers/vigiladorController'; // ← .js
import { authMiddleware } from '../services/authService';

const router = Router();

router.post('/submit', VigiladorController.submit);
router.get('/estado/:legajo', VigiladorController.getEstado);
router.get('/estado/:legajo', authMiddleware(['ADMIN', 'CLIENT']), VigiladorController.getEstado);

export default router;