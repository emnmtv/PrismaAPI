import { Response } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import { PrismaClient } from '@prisma/client';
import { createNotification } from '../utils/authUtils';

const prisma = new PrismaClient();

// Helper to format currency amounts for display (converts from cents to dollars)
const formatCurrency = (amount: number): string => {
  return `$${(amount / 100).toFixed(2)}`;
};

// Calculate admin fee (20% of transaction amount)
const calculateAdminFee = (amount: number): number => {
  return Math.floor(amount * 0.20); // 20% of the amount
};

// Get app overview stats
export const getAppOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Get total users count by role
    const userCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        id: true
      }
    });

    // Format user counts into an object
    const users = userCounts.reduce((acc, curr) => {
      acc[curr.role] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Get total users count
    const totalUsers = await prisma.user.count();

    // Get total transactions and amount
    const transactions = await prisma.payment.aggregate({
      where: {
        status: 'paid'
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true,
        adminFee: true
      }
    });

    // Get posts count by status
    const postCounts = await prisma.post.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    // Format post counts into an object
    const posts = postCounts.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    // Get total posts count
    const totalPosts = await prisma.post.count();

    // Get total engagements
    const engagements = await prisma.engagement.count();

    // Get total messages
    const messages = await prisma.message.count();

    // Get creators with copyright strikes
    const creatorsWithStrikes = await prisma.user.count({
      where: {
        copyrightStrikes: { gt: 0 }
      }
    });

    // Get current active users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: { gte: thirtyDaysAgo }
      }
    });

    // Get current active creators (with at least one post)
    const activeCreators = await prisma.user.count({
      where: {
        role: 'creator',
        posts: {
          some: {}
        }
      }
    });

    // Get average rating across all creators
    const ratings = await prisma.rating.aggregate({
      _avg: {
        rating: true
      }
    });

    // Calculate admin revenue (20% of total transactions)
    const totalAmount = transactions._sum?.amount || 0;
    const claimedAdminRevenue = transactions._sum?.adminFee || 0;
    
    // Get unclaimed admin fees
    const unclaimedFees = await prisma.payment.aggregate({
      where: {
        status: 'paid',
        isFeeClaimed: false
      },
      _sum: {
        amount: true
      }
    });
    
    const potentialAdminRevenue = calculateAdminFee((unclaimedFees._sum?.amount) || 0);

    // Build the response object
    const overview = {
      users: {
        total: totalUsers,
        byRole: users,
        active: activeUsers,
        activeCreators
      },
      transactions: {
        count: transactions._count?.id || 0,
        totalAmount: formatCurrency(totalAmount),
        rawAmount: totalAmount,
      },
      adminRevenue: {
        total: formatCurrency(claimedAdminRevenue),
        rawTotal: claimedAdminRevenue,
        unclaimed: formatCurrency(potentialAdminRevenue),
        rawUnclaimed: potentialAdminRevenue,
        potential: formatCurrency(claimedAdminRevenue + potentialAdminRevenue),
        rawPotential: claimedAdminRevenue + potentialAdminRevenue
      },
      posts: {
        total: totalPosts,
        byStatus: posts
      },
      engagement: {
        total: engagements,
        messages,
        averageRating: ratings._avg.rating || 0
      },
      copyrightStrikes: creatorsWithStrikes
    };

    res.status(200).json(overview);
  } catch (error) {
    console.error('Error fetching app overview:', error);
    res.status(500).json({ 
      error: 'Failed to fetch app overview',
      details: (error as Error).message
    });
  }
};

// Get transaction details with pagination
export const getTransactionDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get transactions with user details
    const transactions = await prisma.payment.findMany({
      where: {
        status: 'paid'
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.payment.count({
      where: {
        status: 'paid'
      }
    });

    // Calculate admin fee for each transaction if not present
    const transactionsWithFees = transactions.map(transaction => {
      // If adminFee is not set, calculate it
      if (transaction.adminFee === null) {
        return {
          ...transaction,
          calculatedAdminFee: calculateAdminFee(transaction.amount),
          formattedAmount: formatCurrency(transaction.amount),
          formattedAdminFee: formatCurrency(calculateAdminFee(transaction.amount))
        };
      }
      
      return {
        ...transaction,
        calculatedAdminFee: transaction.adminFee,
        formattedAmount: formatCurrency(transaction.amount),
        formattedAdminFee: formatCurrency(transaction.adminFee)
      };
    });

    res.status(200).json({
      transactions: transactionsWithFees,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transaction details',
      details: (error as Error).message
    });
  }
};

// Claim admin fees for specific transactions
export const claimAdminFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    const { transactionIds } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      res.status(400).json({ error: 'Transaction IDs array is required' });
      return;
    }

    // Get the transactions to make sure they exist and are valid
    const transactions = await prisma.payment.findMany({
      where: {
        id: { in: transactionIds },
        status: 'paid',
        isFeeClaimed: false
      }
    });

    if (transactions.length === 0) {
      res.status(404).json({ error: 'No valid unclaimed transactions found' });
      return;
    }

    // Calculate admin fees and update transactions
    const updates = transactions.map(transaction => {
      const adminFee = transaction.adminFee ?? calculateAdminFee(transaction.amount);
      
      return prisma.payment.update({
        where: { id: transaction.id },
        data: {
          adminFee,
          isFeeClaimed: true
        }
      });
    });

    // Execute all updates in parallel
    const updatedTransactions = await Promise.all(updates);

    // Calculate total claimed
    const totalClaimed = updatedTransactions.reduce((sum, tx) => sum + (tx.adminFee || 0), 0);

    res.status(200).json({
      message: `Successfully claimed admin fees for ${updatedTransactions.length} transactions`,
      totalClaimed: formatCurrency(totalClaimed),
      rawTotalClaimed: totalClaimed,
      claimedTransactions: updatedTransactions.length
    });
  } catch (error) {
    console.error('Error claiming admin fees:', error);
    res.status(500).json({ 
      error: 'Failed to claim admin fees',
      details: (error as Error).message
    });
  }
};

// Generate daily analytics
export const generateDailyAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Get the date to generate analytics for (default to today)
    const dateParam = req.query.date as string;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    // Format date as YYYY-MM-DD
    const dateString = targetDate.toISOString().split('T')[0];
    
    // Define the date range for the day
    const startOfDay = new Date(dateString);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateString);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all transactions for the day
    const transactions = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'paid'
      }
    });

    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const adminRevenue = transactions.reduce((sum, tx) => {
      if (tx.adminFee) {
        return sum + tx.adminFee;
      }
      return sum + calculateAdminFee(tx.amount);
    }, 0);

    // Get user stats
    const userCount = await prisma.user.count();
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    const activeUsers = await prisma.user.count({
      where: {
        updatedAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Get post stats
    const postCount = await prisma.post.count();
    const newPosts = await prisma.post.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Get engagement stats
    const engagementCount = await prisma.engagement.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Get message stats
    const messageCount = await prisma.message.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Get copyright strikes for the day
    const copyrightStrikes = await prisma.user.aggregate({
      where: {
        updatedAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        copyrightStrikes: {
          gt: 0
        }
      },
      _sum: {
        copyrightStrikes: true
      }
    });

    // Get top creators for the day
    const topCreators = await prisma.payment.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'paid'
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      },
      take: 10
    });

    // Get creator details
    const creatorIds = topCreators.map(c => c.userId);
    const creatorDetails = await prisma.user.findMany({
      where: {
        id: { in: creatorIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    // Map creator details to top creators
    const topCreatorsWithDetails = topCreators.map(creator => {
      const details = creatorDetails.find(d => d.id === creator.userId);
      return {
        id: creator.userId,
        name: details ? `${details.firstName} ${details.lastName}` : 'Unknown',
        email: details?.email,
        totalEarnings: formatCurrency(creator._sum.amount || 0),
        rawEarnings: creator._sum.amount || 0,
        transactions: creator._count.id
      };
    });

    // Get top posts by engagement
    const topPosts = await prisma.engagement.groupBy({
      by: ['postId'],
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        postId: { not: null }
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
    const postIds = topPosts
      .map(p => p.postId)
      .filter((id): id is number => id !== null);
      
    const postDetails = await prisma.post.findMany({
      where: {
        id: { in: postIds }
      },
      select: {
        id: true,
        title: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Map post details to top posts
    const topPostsWithDetails = topPosts
      .filter(post => post.postId !== null) // Filter out posts with null ID
      .map(post => {
        const details = postDetails.find(d => d.id === post.postId);
        return {
          id: post.postId,
          title: details?.title || 'Unknown',
          authorName: details?.user ? `${details.user.firstName} ${details.user.lastName}` : 'Unknown',
          authorId: details?.userId,
          engagements: post._count.id
        };
      });

    // Calculate average rating for the day
    const ratings = await prisma.rating.aggregate({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      _avg: {
        rating: true
      }
    });

    // Create or update app analytics record
    const appAnalytics = await prisma.appAnalytics.upsert({
      where: {
        date: dateString
      },
      create: {
        date: dateString,
        totalTransactions,
        totalAmount,
        adminRevenue,
        userCount,
        newUserCount: newUsers,
        activeUserCount: activeUsers,
        postCount,
        newPostCount: newPosts,
        engagementCount,
        messageCount,
        copyrightStrikes: copyrightStrikes._sum.copyrightStrikes || 0,
        averageRating: ratings._avg.rating || null,
        topCreators: JSON.stringify(topCreatorsWithDetails),
        topPosts: JSON.stringify(topPostsWithDetails)
      },
      update: {
        totalTransactions,
        totalAmount,
        adminRevenue,
        userCount,
        newUserCount: newUsers,
        activeUserCount: activeUsers,
        postCount,
        newPostCount: newPosts,
        engagementCount,
        messageCount,
        copyrightStrikes: copyrightStrikes._sum.copyrightStrikes || 0,
        averageRating: ratings._avg.rating || null,
        topCreators: JSON.stringify(topCreatorsWithDetails),
        topPosts: JSON.stringify(topPostsWithDetails),
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      message: `Analytics generated for ${dateString}`,
      analytics: {
        ...appAnalytics,
        topCreators: topCreatorsWithDetails,
        topPosts: topPostsWithDetails,
        formattedTotalAmount: formatCurrency(totalAmount),
        formattedAdminRevenue: formatCurrency(adminRevenue)
      }
    });
  } catch (error) {
    console.error('Error generating daily analytics:', error);
    res.status(500).json({ 
      error: 'Failed to generate daily analytics',
      details: (error as Error).message
    });
  }
};

// Get analytics for a date range
export const getAnalyticsRange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Get the start and end dates from the query
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Both startDate and endDate are required' });
      return;
    }

    // Fetch analytics data for the date range
    const analyticsData = await prisma.appAnalytics.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Parse JSON fields
    const parsedData = analyticsData.map(data => {
      return {
        ...data,
        topCreators: data.topCreators ? JSON.parse(data.topCreators) : [],
        topPosts: data.topPosts ? JSON.parse(data.topPosts) : [],
        formattedTotalAmount: formatCurrency(data.totalAmount),
        formattedAdminRevenue: formatCurrency(data.adminRevenue)
      };
    });

    // Calculate summary metrics
    const summary = {
      totalTransactions: parsedData.reduce((sum, day) => sum + day.totalTransactions, 0),
      totalAmount: parsedData.reduce((sum, day) => sum + day.totalAmount, 0),
      adminRevenue: parsedData.reduce((sum, day) => sum + day.adminRevenue, 0),
      newUsers: parsedData.reduce((sum, day) => sum + day.newUserCount, 0),
      newPosts: parsedData.reduce((sum, day) => sum + day.newPostCount, 0),
      engagements: parsedData.reduce((sum, day) => sum + day.engagementCount, 0),
      messages: parsedData.reduce((sum, day) => sum + day.messageCount, 0),
      copyrightStrikes: parsedData.reduce((sum, day) => sum + day.copyrightStrikes, 0),
      // Calculate average of average ratings
      averageRating: parsedData.reduce((sum, day) => {
        if (day.averageRating === null) return sum;
        return sum + day.averageRating;
      }, 0) / parsedData.filter(day => day.averageRating !== null).length || 0
    };

    res.status(200).json({
      data: parsedData,
      summary: {
        ...summary,
        formattedTotalAmount: formatCurrency(summary.totalAmount),
        formattedAdminRevenue: formatCurrency(summary.adminRevenue)
      },
      dateRange: {
        startDate,
        endDate,
        days: parsedData.length
      }
    });
  } catch (error) {
    console.error('Error fetching analytics range:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics data',
      details: (error as Error).message
    });
  }
};

// Update payment to record admin fee
export const updateAdminFee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    const { paymentId } = req.params;
    
    if (!paymentId) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) }
    });

    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    // Calculate admin fee
    const adminFee = calculateAdminFee(payment.amount);

    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId) },
      data: {
        adminFee,
        isFeeClaimed: false
      }
    });

    res.status(200).json({
      message: 'Admin fee updated successfully',
      payment: {
        ...updatedPayment,
        formattedAmount: formatCurrency(updatedPayment.amount),
        formattedAdminFee: formatCurrency(updatedPayment.adminFee || 0)
      }
    });
  } catch (error) {
    console.error('Error updating admin fee:', error);
    res.status(500).json({ 
      error: 'Failed to update admin fee',
      details: (error as Error).message
    });
  }
};

// Set up a scheduled job to run analytics (can be called via cron or manually)
export const runScheduledAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // This can be open to admins or triggered by a cron job with proper auth
    const isAdmin = req.user && await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { role: true }
    }).then(user => user?.role === 'admin');

    const isScheduledJob = req.headers['x-scheduled-job'] === process.env.SCHEDULED_JOB_SECRET;

    if (!isAdmin && !isScheduledJob) {
      res.status(403).json({ error: 'Unauthorized: Only admins or scheduled jobs can trigger this endpoint' });
      return;
    }

    // Default to yesterday for scheduled jobs
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateString = date.toISOString().split('T')[0];

    // Create a mock request and response for internal API call
    const mockReq = {
      user: { userId: req.user?.userId || 1 }, // Use the actual user or default to ID 1
      query: { date: dateString }
    } as unknown as AuthRequest;

    let analyticsResult: any = null;

    // Create a mock response
    const mockRes = {
      status: (_code: number) => {
        return {
          json: (data: any) => {
            analyticsResult = data;
            return mockRes;
          }
        };
      }
    } as unknown as Response;

    // Run the generate analytics function
    await generateDailyAnalytics(mockReq, mockRes);

    if (!analyticsResult) {
      throw new Error('Failed to generate analytics');
    }

    // Notify admins about the analytics
    const admins = await prisma.user.findMany({
      where: { role: 'admin' }
    });

    for (const admin of admins) {
      const analytics = analyticsResult.analytics;
      
      // Create a notification for each admin
      await createNotification(
        admin.id,
        'admin_alert',
        `Daily Analytics for ${dateString}`,
        `<p>The daily analytics report for ${dateString} has been generated.</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li>Transactions: ${analytics.totalTransactions}</li>
          <li>Revenue: ${analytics.formattedTotalAmount}</li>
          <li>Admin Revenue: ${analytics.formattedAdminRevenue}</li>
          <li>New Users: ${analytics.newUserCount}</li>
          <li>New Posts: ${analytics.newPostCount}</li>
        </ul>
        <p>View the complete report in the admin dashboard.</p>`
      );
    }

    res.status(200).json({
      message: `Scheduled analytics job completed for ${dateString}`,
      result: analyticsResult
    });
  } catch (error) {
    console.error('Error running scheduled analytics:', error);
    res.status(500).json({ 
      error: 'Failed to run scheduled analytics',
      details: (error as Error).message
    });
  }
};

// Export functions
export default {
  getAppOverview,
  getTransactionDetails,
  claimAdminFees,
  generateDailyAnalytics,
  getAnalyticsRange,
  updateAdminFee,
  runScheduledAnalytics
}; 