import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authRequest';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Helper function to check if user is admin
const isAdmin = async (userId: number): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  return user?.role === 'admin';
};

/**
 * Submit a new report about a user
 */
const submitReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reporterId = req.user?.userId;
    if (!reporterId) {
      res.status(401).json({ error: 'Authentication required to submit a report' });
      return;
    }

    const { reportedUserId, reason, details, category } = req.body;

    // Validate required fields
    if (!reportedUserId || !reason || !category) {
      res.status(400).json({ error: 'Missing required fields: reportedUserId, reason, and category are required' });
      return;
    }

    // Make sure reporter isn't reporting themselves
    if (reporterId === parseInt(reportedUserId)) {
      res.status(400).json({ error: 'You cannot report yourself' });
      return;
    }

    // Check if reported user exists
    const reportedUser = await prisma.user.findUnique({
      where: { id: parseInt(reportedUserId) },
      select: { id: true, email: true }
    });

    if (!reportedUser) {
      res.status(404).json({ error: 'Reported user not found' });
      return;
    }

    // Process file attachment if exists
    let evidenceImage = null;
    if (req.file) {
      evidenceImage = req.file.path;
    }

    // Create the report
    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedUserId: parseInt(reportedUserId),
        reason,
        details: details || '',
        category,
        evidenceImage,
        status: 'pending'
      }
    });

    // Create notification for admins
    const adminUsers = await prisma.user.findMany({
      where: { role: 'admin' }
    });

    // Create notifications for all admin users
    if (adminUsers.length > 0) {
      const notifications = adminUsers.map(admin => ({
        userId: admin.id,
        type: 'report',
        title: 'New User Report',
        message: `A user has been reported for ${category}: ${reason}`,
        relatedId: report.id,
        read: false
      }));

      await prisma.notification.createMany({
        data: notifications
      });
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      reportId: report.id
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

/**
 * Get all reports for admin review
 */
const getReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Parse query parameters
    const { status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where condition based on status filter
    const whereCondition: any = {};
    if (status) {
      whereCondition.status = status;
    }

    // Count total reports for pagination
    const totalReports = await prisma.report.count({
      where: whereCondition
    });

    // Get paginated reports with reporter and reported user details
    const reports = await prisma.report.findMany({
      where: whereCondition,
      skip,
      take: limitNum,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            role: true,
            creatorProfile: true
          }
        }
      }
    });

    res.status(200).json({
      reports,
      pagination: {
        total: totalReports,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalReports / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
};

/**
 * Update report status and take action
 */
const updateReportStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    const { reportId } = req.params;
    const { status, adminComment, action } = req.body;

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    // Validate status
    const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    // Find the report
    const report = await prisma.report.findUnique({
      where: { id: parseInt(reportId) },
      include: {
        reportedUser: true
      }
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Update the report
    const updatedReport = await prisma.report.update({
      where: { id: parseInt(reportId) },
      data: {
        status,
        adminComment,
        resolvedAt: status === 'resolved' || status === 'dismissed' ? new Date() : null,
        adminId: userId
      }
    });

    // Take action on the reported user if specified and report is resolved
    if (status === 'resolved' && action && report.reportedUser) {
      if (action === 'warn') {
        // Send warning notification to user
        await prisma.notification.create({
          data: {
            userId: report.reportedUserId,
            type: 'warning',
            title: 'Account Warning',
            message: `Your account has received a warning regarding: ${report.reason}`,
            read: false
          }
        });
      } else if (action === 'suspend') {
        // Suspend the user
        const suspensionDuration = req.body.suspensionDuration || 7; // Default 7 days
        const suspensionDate = new Date();
        suspensionDate.setDate(suspensionDate.getDate() + parseInt(suspensionDuration));

        await prisma.user.update({
          where: { id: report.reportedUserId },
          data: {
            restrictionType: 'suspended',
            restrictionExpiresAt: suspensionDate,
            underReview: false
          }
        });

        // Send suspension notification
        await prisma.notification.create({
          data: {
            userId: report.reportedUserId,
            type: 'suspension',
            title: 'Account Suspended',
            message: `Your account has been suspended for ${suspensionDuration} days due to: ${report.reason}`,
            read: false
          }
        });
      } else if (action === 'restrict') {
        // Restrict specific features
        await prisma.user.update({
          where: { id: report.reportedUserId },
          data: {
            restrictionType: 'restricted',
            underReview: true
          }
        });

        // Send restriction notification
        await prisma.notification.create({
          data: {
            userId: report.reportedUserId,
            type: 'restriction',
            title: 'Account Restricted',
            message: `Some features of your account have been restricted due to: ${report.reason}`,
            read: false
          }
        });
      }
    }

    res.status(200).json({
      message: 'Report status updated successfully',
      report: updatedReport
    });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
};

/**
 * Get a single report with all details
 */
const getReportDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    const { reportId } = req.params;

    const report = await prisma.report.findUnique({
      where: { id: parseInt(reportId) },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            role: true,
            creatorProfile: true,
            posts: {
              where: {
                status: {
                  in: ['pending', 'approved']
                }
              },
              take: 10,
              orderBy: {
                createdAt: 'desc'
              }
            },
            copyrightStrikes: true,
            restrictionType: true,
            restrictionExpiresAt: true
          }
        },
        admin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.status(200).json({ report });
  } catch (error) {
    console.error('Error getting report details:', error);
    res.status(500).json({ error: 'Failed to get report details' });
  }
};

/**
 * Delete a report (admin only)
 */
const deleteReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    const { reportId } = req.params;

    // Find the report first to get the evidence image path
    const report = await prisma.report.findUnique({
      where: { id: parseInt(reportId) },
      select: { evidenceImage: true }
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    // Delete the evidence image file if it exists
    if (report.evidenceImage) {
      const imagePath = path.resolve(report.evidenceImage);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the report
    await prisma.report.delete({
      where: { id: parseInt(reportId) }
    });

    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
};

export default {
  submitReport,
  getReports,
  updateReportStatus,
  getReportDetails,
  deleteReport
};
