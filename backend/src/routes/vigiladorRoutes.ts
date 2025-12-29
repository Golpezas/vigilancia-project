// src/routes/vigiladorRoutes.ts
import { Router } from 'express';
import { VigiladorController } from '../controllers/vigiladorController'; // ← Sin .js

const router = Router();

router.post('/submit', VigiladorController.submit);
router.get('/estado/:legajo', VigiladorController.getEstado);

export default router;