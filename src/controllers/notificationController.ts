import { Response } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  reviewUserCopyrightStatus
} from '../utils/authUtils';

// Get user's notifications
export const handleGetNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const includeRead = req.query.includeRead === 'true';
    
    const result = await getUserNotifications(userId, limit, offset, includeRead);
    
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Mark a notification as read
export const handleMarkNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { notificationId } = req.params;
    
    if (!notificationId) {
      throw new Error('Notification ID is required');
    }
    
    const notification = await markNotificationAsRead(parseInt(notificationId), userId);
    
    res.status(200).json({ 
      message: 'Notification marked as read', 
      notification 
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Mark all notifications as read
export const handleMarkAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    const result = await markAllNotificationsAsRead(userId);
    
    res.status(200).json({ 
      message: `${result.count} notifications marked as read`
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle admin review of user copyright status
export const handleReviewUserCopyrightStatus = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.userId;
    const { userId, action, duration } = req.body;
    
    if (!userId || !action) {
      throw new Error('User ID and action are required');
    }
    
    if (!['clear', 'warn', 'suspend', 'unsuspend'].includes(action)) {
      throw new Error('Invalid action. Must be "clear", "warn", "suspend", or "unsuspend"');
    }
    
    // Require duration for warn and suspend actions
    if ((action === 'warn' || action === 'suspend') && !duration) {
      throw new Error('Duration (in days) is required for warn and suspend actions');
    }
    
    // Parse duration to number
    const durationDays = duration ? parseInt(duration) : undefined;
    
    if (durationDays !== undefined && (isNaN(durationDays) || durationDays <= 0)) {
      throw new Error('Duration must be a positive number of days');
    }
    
    const result = await reviewUserCopyrightStatus(
      adminId, 
      parseInt(userId), 
      action as 'clear' | 'warn' | 'suspend' | 'unsuspend',
      durationDays
    );
    
    res.status(200).json({
      message: `User ${action} action completed successfully`,
      result
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export default {
  handleGetNotifications,
  handleMarkNotificationAsRead,
  handleMarkAllNotificationsAsRead,
  handleReviewUserCopyrightStatus
}; 