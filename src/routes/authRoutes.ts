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
  handleGetUserWithProfileAndPosts2,
  handleGetAllPostsWithUserDetails,
  handleInitiatePayment,
  handleCheckPaymentStatus,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { sendMessage, fetchMessages, getUsersWithChatHistory } from '../controllers/chatController';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/verify', handleEmailVerification);
authRouter.get('/viewuserpost2', handleGetUserWithProfileAndPosts2);
authRouter.get('/viewpost', handleGetPostWithUserDetails);
authRouter.get('/allpost', handleGetAllPostsWithUserDetails);



// Protected routes
authRouter.get('/profile', authenticateToken, handleGetProfile);
authRouter.put('/profile', authenticateToken, handleUpdateProfile);
authRouter.post('/upgrade', authenticateToken,handleUpgradeToCreator);
authRouter.post('/payment', authenticateToken,handleInitiatePayment);
authRouter.get('/cprofile', authenticateToken,handleGetCreatorProfile);
authRouter.put('/editcprofile', authenticateToken,handleEditCreatorProfile);
authRouter.put('/editpost', upload.fields([{ name: 'image' }, { name: 'video' }]),authenticateToken,handleEditPost);
authRouter.put('/delete', authenticateToken,handleDeletePost);
authRouter.post('/createpost', upload.fields([{ name: 'image' }, { name: 'video' }]),authenticateToken,handleCreatePost);
authRouter.get('/viewuserpost',authenticateToken, handleGetUserWithProfileAndPosts);
authRouter.post('/sendmessage', authenticateToken, sendMessage);
authRouter.get('/messages/:otherUserId', authenticateToken, fetchMessages);
authRouter.get('/chat-users', authenticateToken, getUsersWithChatHistory);
authRouter.get('/payment/status', authenticateToken, handleCheckPaymentStatus);
export { authRouter };
