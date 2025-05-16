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
  handleGetUsersUnderReview,
  handleGetUsersWithRestrictions,
  handleForgotPassword,
  handleResetPassword,
  handleApplyForVerification,
  handleReviewCreatorVerification,
  handleGetPendingVerifications
} from '../controllers/authController';
import { authenticateToken } from '../middleware/authMiddleware';
import { sendMessage, fetchMessages, getUsersWithChatHistory } from '../controllers/chatController';
import analyticsController from '../controllers/analyticsController';
import notificationController from '../controllers/notificationController';
import adminAnalyticsController from '../controllers/adminAnalyticsController';
import reportingController from '../controllers/reportingController';

const authRouter = express.Router();

// Public routes
authRouter.post('/register', handleRegister);
authRouter.post('/login', handleLogin);
authRouter.post('/verify', handleEmailVerification);
authRouter.get('/viewuserpost2', handleGetUserWithProfileAndPosts2);
authRouter.get('/viewpost', handleGetPostWithUserDetails);
authRouter.get('/allpost', handleGetAllPostsWithUserDetails);
authRouter.post('/forgot-password', handleForgotPassword);
authRouter.post('/reset-password', handleResetPassword);

// Protected routes
authRouter.get('/profile', authenticateToken, handleGetProfile);
authRouter.put('/profile', authenticateToken, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'coverPhoto', maxCount: 1 }
]), handleUpdateProfile);
authRouter.post('/upgrade', authenticateToken, upload.fields([
  { name: 'portfolioFile', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 }
]), handleUpgradeToCreator);
authRouter.post('/payment', authenticateToken,handleInitiatePayment);
authRouter.get('/cprofile', authenticateToken,handleGetCreatorProfile);
authRouter.put('/editcprofile', authenticateToken, upload.fields([
  { name: 'portfolioFile', maxCount: 1 },
  { name: 'resumeFile', maxCount: 1 }
]), handleEditCreatorProfile);
authRouter.put('/editpost', upload.fields([
  { name: 'image' }, 
  { name: 'video' },
  { name: 'audio' }
]), authenticateToken, handleEditPost);
authRouter.put('/delete', authenticateToken,handleDeletePost);
authRouter.post('/createpost', upload.fields([
  { name: 'image' }, 
  { name: 'video' },
  { name: 'audio' }
]), authenticateToken, handleCreatePost);
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

// Creator verification routes
authRouter.post('/verification/apply', authenticateToken, upload.fields([
  { name: 'validId', maxCount: 1 }
]), handleApplyForVerification);
authRouter.get('/admin/verifications', authenticateToken, handleGetPendingVerifications);
authRouter.post('/admin/verifications/review', authenticateToken, handleReviewCreatorVerification);

// Notification routes
authRouter.get('/notifications', authenticateToken, notificationController.handleGetNotifications);
authRouter.put('/notifications/:notificationId/read', authenticateToken, notificationController.handleMarkNotificationAsRead);
authRouter.put('/notifications/read-all', authenticateToken, notificationController.handleMarkAllNotificationsAsRead);

// Analytics & Engagement tracking routes - Updated to use analyticsController
authRouter.post('/track/profile-view/:creatorId', analyticsController.handleTrackProfileView);
authRouter.post('/track/post-view/:postId', analyticsController.handleTrackPostView);
authRouter.post('/track/audio-play/:postId', analyticsController.handleTrackAudioPlay);
authRouter.post('/track/click-through', analyticsController.handleTrackClickThrough);
authRouter.get('/analytics/:creatorId?', authenticateToken, analyticsController.handleGetCreatorAnalytics);

// Admin routes
authRouter.put('/post/status', authenticateToken, handleUpdatePostStatus);
authRouter.delete('/post/admin', authenticateToken, handleDeletePostAdmin);
authRouter.get('/admin/posts', authenticateToken, handleGetAdminPosts);
authRouter.get('/admin/users', authenticateToken, handleGetAllUsers);
authRouter.get('/admin/users/review', authenticateToken, handleGetUsersUnderReview);
authRouter.get('/admin/users/restricted', authenticateToken, handleGetUsersWithRestrictions);
authRouter.put('/admin/copyright-review', authenticateToken, notificationController.handleReviewUserCopyrightStatus);

// Admin analytics routes
authRouter.get('/admin/analytics/revenue', authenticateToken, adminAnalyticsController.getRevenueAnalytics);
authRouter.get('/admin/analytics/users', authenticateToken, adminAnalyticsController.getUserGrowthAnalytics);
authRouter.get('/admin/analytics/creators', authenticateToken, adminAnalyticsController.getCreatorPerformance);
authRouter.get('/admin/analytics/content', authenticateToken, adminAnalyticsController.getContentPerformance);
authRouter.get('/admin/settings/fee', authenticateToken, adminAnalyticsController.getCurrentFeePercentage);
authRouter.put('/admin/settings/fee', authenticateToken, adminAnalyticsController.updateFeePercentage);
authRouter.post('/admin/claim-fees', authenticateToken, adminAnalyticsController.claimFees);
authRouter.post('/admin/fix-admin-fees', authenticateToken, adminAnalyticsController.fixAdminFees);

// Add this route
authRouter.post('/google-login', handleGoogleLogin);

// After the admin analytics routes, add reporting routes
authRouter.post('/report-user', authenticateToken, upload.single('evidenceImage'), reportingController.submitReport);
authRouter.get('/admin/reports', authenticateToken, reportingController.getReports);
authRouter.get('/admin/reports/:reportId', authenticateToken, reportingController.getReportDetails);
authRouter.put('/admin/reports/:reportId', authenticateToken, reportingController.updateReportStatus);
authRouter.delete('/admin/reports/:reportId', authenticateToken, reportingController.deleteReport);

export { authRouter };
