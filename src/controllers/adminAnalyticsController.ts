import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authRequest';

// PrismaClient singleton pattern
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Ensure prisma disconnects properly on shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Helper function to check if user is admin
const isAdmin = async (userId: number): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  return user?.role === 'admin';
};

// Get app revenue analytics
const getRevenueAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Parse date range parameters
    const { startDate, endDate, groupBy = 'day', includeTransactions = 'false' } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get all completed payments with admin fees - optimize by selecting only needed fields
    const payments = await prisma.payment.findMany({
      where: {
        status: 'paid',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        amount: true,
        adminFee: true,
        isFeeClaimed: true,
        createdAt: true,
        status: true,
        orderStatus: true,
        referenceNumber: true,
        userId: true,
        clientId: true
      },
      // Add a reasonable limit to handle large datasets in production
      // Can be removed if pagination is implemented
      take: 1000
    });

    // Calculate totals
    const totalTransactions = payments.length;
    const totalRevenue = payments.reduce((sum, payment) => sum + (payment.adminFee || 0), 0);
    const claimedRevenue = payments
      .filter(p => p.isFeeClaimed)
      .reduce((sum, payment) => sum + (payment.adminFee || 0), 0);
    const unclaimedRevenue = totalRevenue - claimedRevenue;

    // Group data by date according to groupBy parameter
    const revenueByDate: Record<string, { date: string, revenue: number, transactions: number }> = {};

    payments.forEach(payment => {
      let dateKey: string;
      const date = new Date(payment.createdAt);
      
      if (groupBy === 'month') {
        dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (groupBy === 'year') {
        dateKey = date.getFullYear().toString();
      } else { // day is default
        dateKey = date.toISOString().split('T')[0];
      }

      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = { date: dateKey, revenue: 0, transactions: 0 };
      }
      
      revenueByDate[dateKey].revenue += payment.adminFee || 0;
      revenueByDate[dateKey].transactions += 1;
    });

    // Convert to array and sort by date
    const revenueTimeline = Object.values(revenueByDate).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    // Define transaction list type
    interface TransactionDetails {
      id: number;
      referenceNumber: string;
      amount: number;
      adminFee: number | null;
      status: string;
      orderStatus: string;
      isFeeClaimed: boolean;
      createdAt: Date;
      creatorId: number;
      clientId: number;
      creatorName: string;
      clientName: string;
    }

    // If detailed transactions are requested, include them
    let transactionsList: TransactionDetails[] = [];
    if (includeTransactions === 'true') {
      // Get user details for the transactions
      const userIds = [...new Set([...payments.map(p => p.userId), ...payments.map(p => p.clientId)])];
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      // Format transactions with user details
      transactionsList = payments.map(payment => {
        const creator = users.find(u => u.id === payment.userId);
        const client = users.find(u => u.id === payment.clientId);
        
        return {
          id: payment.id,
          referenceNumber: payment.referenceNumber,
          amount: payment.amount,
          adminFee: payment.adminFee,
          status: payment.status,
          orderStatus: payment.orderStatus,
          isFeeClaimed: payment.isFeeClaimed,
          createdAt: payment.createdAt,
          creatorId: payment.userId,
          clientId: payment.clientId,
          creatorName: creator 
            ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email 
            : 'Unknown',
          clientName: client 
            ? `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email 
            : 'Unknown'
        };
      });
    }

    const responseData: {
      totalTransactions: number;
      totalRevenue: number;
      claimedRevenue: number;
      unclaimedRevenue: number;
      revenueTimeline: typeof revenueTimeline;
      currency: string;
      transactions?: TransactionDetails[];
    } = {
      totalTransactions,
      totalRevenue: totalRevenue / 100, // Convert cents to dollars for display
      claimedRevenue: claimedRevenue / 100,
      unclaimedRevenue: unclaimedRevenue / 100,
      revenueTimeline,
      currency: 'USD'
    };

    // Add transactions if requested
    if (includeTransactions === 'true') {
      responseData.transactions = transactionsList;
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error getting revenue analytics:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
};

// Update fee percentage
const updateFeePercentage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    const { feePercentage } = req.body;

    // Validate fee percentage
    if (typeof feePercentage !== 'number' || feePercentage < 0 || feePercentage > 50) {
      res.status(400).json({ error: 'Fee percentage must be a number between 0 and 50' });
      return;
    }

    // Update fee percentage in app settings
    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: { 
        feePercentage,
        value: feePercentage.toString(),
        updatedAt: new Date(),
        lastUpdatedBy: userId
      },
      create: { 
        id: 1,
        key: 'feePercentage',
        value: feePercentage.toString(),
        description: 'Platform fee percentage applied to transactions',
        feePercentage,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdatedBy: userId
      }
    });

    res.status(200).json({ 
      message: 'Fee percentage updated successfully',
      feePercentage: settings.feePercentage
    });
  } catch (error) {
    console.error('Error updating fee percentage:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to update fee percentage' });
  }
};

// Claim fees
const claimFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Get payment IDs to claim or claim all if none specified
    const { paymentIds } = req.body;
    
    let updateQuery;
    if (paymentIds && Array.isArray(paymentIds) && paymentIds.length > 0) {
      // Claim specific payments
      updateQuery = prisma.payment.updateMany({
        where: {
          id: { in: paymentIds },
          status: 'paid',
          isFeeClaimed: false
        },
        data: { isFeeClaimed: true }
      });
    } else {
      // Claim all unclaimed payments
      updateQuery = prisma.payment.updateMany({
        where: {
          status: 'paid',
          isFeeClaimed: false
        },
        data: { isFeeClaimed: true }
      });
    }

    const result = await updateQuery;

    res.status(200).json({
      message: 'Fees claimed successfully',
      claimedCount: result.count
    });
  } catch (error) {
    console.error('Error claiming fees:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to claim fees' });
  }
};

// Get user growth analytics
const getUserGrowthAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Parse date range parameters
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get all users created in the date range
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true,
        createdAt: true,
        role: true,
        verified: true
      }
    });

    // Calculate current totals
    const totalUsers = await prisma.user.count();
    const totalCreators = await prisma.user.count({
      where: { role: 'creator' }
    });
    const verifiedUsers = await prisma.user.count({
      where: { verified: true }
    });

    // Group by date and role
    const userGrowthByDate: Record<string, { 
      date: string, 
      newUsers: number, 
      newCreators: number,
      newVerifiedUsers: number
    }> = {};

    users.forEach(user => {
      let dateKey: string;
      const date = new Date(user.createdAt);
      
      if (groupBy === 'month') {
        dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (groupBy === 'year') {
        dateKey = date.getFullYear().toString();
      } else { // day is default
        dateKey = date.toISOString().split('T')[0];
      }

      if (!userGrowthByDate[dateKey]) {
        userGrowthByDate[dateKey] = { 
          date: dateKey, 
          newUsers: 0, 
          newCreators: 0,
          newVerifiedUsers: 0
        };
      }
      
      userGrowthByDate[dateKey].newUsers += 1;
      
      if (user.role === 'creator') {
        userGrowthByDate[dateKey].newCreators += 1;
      }
      
      if (user.verified) {
        userGrowthByDate[dateKey].newVerifiedUsers += 1;
      }
    });

    // Convert to array and sort by date
    const userGrowthTimeline = Object.values(userGrowthByDate).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    res.status(200).json({
      totalUsers,
      totalCreators,
      verifiedUsers,
      userGrowthTimeline
    });
  } catch (error) {
    console.error('Error getting user growth analytics:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to get user growth analytics' });
  }
};

// Get creator performance analytics
const getCreatorPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Get top creators by earnings
    const topCreatorsByEarnings = await prisma.payment.groupBy({
      by: ['userId'],
      where: {
        status: 'paid'
      },
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      },
      take: 10
    });

    // Get creator details for the top earners
    const creatorIds = topCreatorsByEarnings.map(c => c.userId);
    const creators = await prisma.user.findMany({
      where: {
        id: { in: creatorIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        creatorProfile: true
      }
    });

    // Get top creators by engagement
    const topCreatorsByEngagement = await prisma.engagement.groupBy({
      by: ['creatorId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Get creator details for top engagement
    const engagementCreatorIds = topCreatorsByEngagement.map(c => c.creatorId);
    const engagementCreators = await prisma.user.findMany({
      where: {
        id: { in: engagementCreatorIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        creatorProfile: true
      }
    });

    // Get top creators by ratings
    const topCreatorsByRating = await prisma.rating.groupBy({
      by: ['userId'],
      _avg: {
        rating: true
      },
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 3 // Minimum number of ratings to be considered
          }
        }
      },
      orderBy: {
        _avg: {
          rating: 'desc'
        }
      },
      take: 10
    });

    // Get creator details for top rated
    const ratingCreatorIds = topCreatorsByRating.map(c => c.userId);
    const ratingCreators = await prisma.user.findMany({
      where: {
        id: { in: ratingCreatorIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePicture: true,
        creatorProfile: true
      }
    });

    // Format the response
    const formatCreatorList = (creatorList: any[], detailsList: any[], valueKey: string) => {
      return creatorList.map(item => {
        const creator = detailsList.find(c => c.id === item.userId || c.id === item.creatorId);
        return {
          id: creator?.id,
          name: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email : 'Unknown',
          email: creator?.email,
          profilePicture: creator?.profilePicture,
          profession: creator?.creatorProfile?.profession || 'N/A',
          value: valueKey === 'earnings' 
            ? (item._sum?.amount || 0) / 100 // Convert cents to dollars
            : valueKey === 'engagement'
              ? item._count?.id
              : item._avg?.rating
        };
      });
    };

    res.status(200).json({
      topEarners: formatCreatorList(topCreatorsByEarnings, creators, 'earnings'),
      topEngagers: formatCreatorList(topCreatorsByEngagement, engagementCreators, 'engagement'),
      topRated: formatCreatorList(topCreatorsByRating, ratingCreators, 'rating')
    });
  } catch (error) {
    console.error('Error getting creator performance analytics:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to get creator performance analytics' });
  }
};

// Get content performance analytics (posts)
const getContentPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Get top posts by views
    const topPostsByViews = await prisma.engagement.groupBy({
      by: ['postId'],
      where: {
        type: 'post_view',
        NOT: { postId: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Get post details
    const postIds = topPostsByViews
      .map(p => p.postId)
      .filter((id): id is number => id !== null);
    
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds }
      },
      select: {
        id: true,
        title: true,
        image: true,
        audio: true,
        video: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Get audio engagement stats
    const audioEngagementStats = await prisma.engagement.groupBy({
      by: ['postId'],
      where: {
        type: 'audio_play',
        NOT: { postId: null }
      },
      _count: {
        id: true
      },
      _avg: {
        duration: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Format the response
    const formatPostList = (postList: any[]) => {
      return postList.map(item => {
        const post = posts.find(p => p.id === item.postId);
        return {
          id: item.postId,
          title: post?.title || 'Unknown Post',
          image: post?.image,
          hasAudio: !!post?.audio,
          hasVideo: !!post?.video,
          creatorName: post?.user 
            ? `${post.user.firstName || ''} ${post.user.lastName || ''}`.trim() || post.user.email 
            : 'Unknown',
          creatorId: post?.userId,
          viewCount: item._count?.id || 0,
          avgDuration: item._avg?.duration || 0
        };
      });
    };

    res.status(200).json({
      topViewedPosts: formatPostList(topPostsByViews),
      topAudioEngagements: formatPostList(audioEngagementStats)
    });
  } catch (error) {
    console.error('Error getting content performance analytics:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to get content performance analytics' });
  }
};

// Get current fee percentage
const getCurrentFeePercentage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const settings = await prisma.appSettings.findFirst({
      where: { key: 'feePercentage' },
      select: { 
        feePercentage: true,
        updatedAt: true,
        lastUpdatedBy: true
      }
    });

    let feePercentage = 20.0; // Default if not set
    
    if (settings) {
      feePercentage = settings.feePercentage;
    } else {
      // Create default setting if it doesn't exist
      await prisma.appSettings.create({
        data: {
          key: 'feePercentage',
          value: feePercentage.toString(),
          description: 'Platform fee percentage applied to transactions',
          feePercentage,
          lastUpdatedBy: userId
        }
      });
    }

    res.status(200).json({
      feePercentage,
      lastUpdated: settings?.updatedAt,
      lastUpdatedBy: settings?.lastUpdatedBy
    });
  } catch (error) {
    console.error('Error getting fee percentage:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to get fee percentage' });
  }
};

// Fix admin fees for existing payments
const fixAdminFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if user is admin
    const admin = await isAdmin(userId);
    if (!admin) {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Get current fee percentage
    const settings = await prisma.appSettings.findFirst({
      where: { key: 'feePercentage' },
      select: { feePercentage: true }
    });
    
    const feePercentage = settings?.feePercentage || 20.0;

    // Find all paid payments with null adminFee
    const paymentsToFix = await prisma.payment.findMany({
      where: {
        status: 'paid',
        adminFee: null
      },
      select: {
        id: true,
        amount: true
      }
    });

    // Update each payment with the correct admin fee
    const updates = paymentsToFix.map(payment => {
      const adminFee = Math.round(payment.amount * (feePercentage / 100));
      return prisma.payment.update({
        where: { id: payment.id },
        data: { adminFee }
      });
    });

    await prisma.$transaction(updates);

    res.status(200).json({
      message: 'Admin fees fixed successfully',
      fixedCount: paymentsToFix.length
    });
  } catch (error) {
    console.error('Error fixing admin fees:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fix admin fees' });
  }
};

export default {
  getRevenueAnalytics,
  updateFeePercentage,
  claimFees,
  getUserGrowthAnalytics,
  getCreatorPerformance,
  getContentPerformance,
  getCurrentFeePercentage,
  fixAdminFees
};
