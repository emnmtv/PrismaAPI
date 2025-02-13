import express from 'express';
import { upload } from '../middleware/fileUpload';
import { 
  handleRegister, 
  handleLogin, 
  handleGetProfile, 
  handleUpdateProfile, 
  handleEmailVerification, 
  handleUpgradeToCreator,
  handleGetCreatorProfile,
  handleEditCreatorProfile,
  handleCreatePost,
  handleGetUserWithProfileAndPosts,
  handleGetPostWithUserDetails,
  handleEditPost,
  handleDeletePost,


} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/verify', handleEmailVerification);
authRouter.get('/viewuserpost', handleGetUserWithProfileAndPosts);
authRouter.get('/viewpost', handleGetPostWithUserDetails);




// Protected routes
authRouter.get('/profile', authenticateToken, handleGetProfile);
authRouter.put('/profile', authenticateToken, handleUpdateProfile);
authRouter.post('/upgrade', authenticateToken,handleUpgradeToCreator);
authRouter.get('/cprofile', authenticateToken,handleGetCreatorProfile);
authRouter.put('/editcprofile', authenticateToken,handleEditCreatorProfile);
authRouter.put('/editpost', authenticateToken,handleEditPost);
authRouter.put('/delete', authenticateToken,handleDeletePost);
authRouter.post('/createpost', upload.fields([{ name: 'image' }, { name: 'video' }]),authenticateToken,handleCreatePost);

export { authRouter };
