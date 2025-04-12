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
  handleFetchPayments,
  handleUpdateOrderStatus,
  handleFetchPaymentsForClient,
  handleUpdateOrderStatusForClient,
  handleSubmitRating,
  handleGetCreatorRatings,
  handleGetCreatorRatingsByCreatorId,
  handleUpdatePostStatus,
  handleDeletePostAdmin,
  handleGetAdminPosts,
  handleGetAllUsers,
  handleGoogleLogin,
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
authRouter.put('/profile', authenticateToken, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), handleUpdateProfile);
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
authRouter.get('/payments', authenticateToken, handleFetchPayments);
authRouter.put('/payment/status', authenticateToken, handleUpdateOrderStatus);
authRouter.get('/client/payments', authenticateToken, handleFetchPaymentsForClient);
authRouter.put('/client/payment/status', authenticateToken, handleUpdateOrderStatusForClient);
authRouter.post('/rate', authenticateToken, handleSubmitRating);
authRouter.get('/ratings', authenticateToken, handleGetCreatorRatings);
authRouter.get('/ratings/:creatorId', authenticateToken, handleGetCreatorRatingsByCreatorId);

// Admin routes
authRouter.put('/post/status', authenticateToken, handleUpdatePostStatus);
authRouter.delete('/post/admin', authenticateToken, handleDeletePostAdmin);
authRouter.get('/admin/posts', authenticateToken, handleGetAdminPosts);
authRouter.get('/admin/users', authenticateToken, handleGetAllUsers);

// Add this route
authRouter.post('/google-login', handleGoogleLogin);

export { authRouter };
