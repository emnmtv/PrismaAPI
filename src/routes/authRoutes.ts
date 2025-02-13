import express from 'express';
import { 
  handleRegister, 
  handleLogin, 
  handleGetProfile, 
  handleUpdateProfile, 
  handleEmailVerification, 
  handleUpgradeToCreator,
  handleGetCreatorProfile,
  handleEditCreatorProfile
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/verify', handleEmailVerification);




// Protected routes
authRouter.get('/profile', authenticateToken, handleGetProfile);
authRouter.put('/profile', authenticateToken, handleUpdateProfile);
authRouter.post('/upgrade', authenticateToken,handleUpgradeToCreator);
authRouter.get('/cprofile', authenticateToken,handleGetCreatorProfile);
authRouter.put('/editcprofile', authenticateToken,handleEditCreatorProfile);

export { authRouter };
