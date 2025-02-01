import express from 'express';
import { register, login, getProfile, updateProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', register);
authRouter.post('/login', login);

// Protected routes
authRouter.get('/profile', authenticateToken, getProfile);
authRouter.put('/profile', authenticateToken, updateProfile);

export { authRouter };