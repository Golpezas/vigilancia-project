// src/routes/authRoutes.ts
import { Router } from 'express';
import { registerUser, loginUser } from '../services/authService';
import { z } from 'zod';

const router = Router();

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post('/register', async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
});

export default router;