import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authRequest';
import geoip from 'geoip-lite';
import * as UAParser from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Helper function to parse and normalize user agent information
 */
const parseUserAgent = (userAgent: string) => {
  if (!userAgent) return null;
  
  const parser = new UAParser.UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`,
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`,
    device: result.device.type || 'desktop',
    deviceVendor: result.device.vendor || 'Unknown',
    deviceModel: result.device.model || 'Unknown'
  };
};

/**
 * Helper function to get location data from IP
 */
const getLocationFromIp = (ip: string) => {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return null;
  
  // Remove IPv6 prefix if present
  const cleanIp = ip.replace(/^::ffff:/, '');
  const geo = geoip.lookup(cleanIp);
  
  if (!geo) return null;
  
  return {
    country: geo.country,
    region: geo.region,
    city: geo.city,
    ll: geo.ll // latitude/longitude
  };
};

/**
 * Handle tracking of profile views with enhanced metadata
 */
export const handleTrackProfileView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { creatorId } = req.params;
    const viewerId = (req as AuthRequest).user?.userId;

    // Get IP address (with fallbacks for various proxy setups)
    const ip = req.headers['x-forwarded-for'] || 
               req.socket.remoteAddress || 
               null;
    
    // Parse user agent for device info
    const userAgent = req.headers['user-agent'];
    const deviceInfo = userAgent ? parseUserAgent(userAgent) : null;
    
    // Get location data
    const location = ip ? getLocationFromIp(String(ip)) : null;
    
    // Get or create session ID
    let sessionId = req.cookies?.session_id;
    if (!sessionId) {
      sessionId = uuidv4();
      // In a real implementation, you would set this cookie in the response
    }
    
    // Get referrer URL
    const referrerUrl = req.headers.referer || null;

    // Create the engagement record with enhanced data
    await prisma.engagement.create({
      data: {
        creatorId: Number(creatorId),
        viewerId: viewerId || null,
        type: 'profile_view',
        ipAddress: String(ip) || null,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        location: location ? JSON.stringify(location) : null,
        sessionId,
        referrerUrl: referrerUrl ? String(referrerUrl) : null,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          fullUrl: req.originalUrl
        })
      }
    });

    // Update daily analytics data
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId: Number(creatorId),
          date: today,
          type: 'profile_views'
        }
      },
      update: {
        count: { increment: 1 }
      },
      create: {
        creatorId: Number(creatorId),
        date: today,
        type: 'profile_views',
        count: 1
      }
    });

    res.status(200).json({ success: true, message: 'Profile view tracked' });
  } catch (error) {
    console.error('Error tracking profile view:', error);
    res.status(500).json({ error: 'Failed to track profile view' });
  }
};

/**
 * Handle tracking of post views with enhanced metadata
 */
export const handleTrackPostView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const viewerId = (req as AuthRequest).user?.userId;

    // Get post details to identify creator
    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      select: { userId: true }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Get IP and user agent information
    const ip = req.headers['x-forwarded-for'] || 
               req.socket.remoteAddress || 
               null;
    
    const userAgent = req.headers['user-agent'];
    const deviceInfo = userAgent ? parseUserAgent(userAgent) : null;
    
    const location = ip ? getLocationFromIp(String(ip)) : null;
    
    // Get or create session ID
    let sessionId = req.cookies?.session_id;
    if (!sessionId) {
      sessionId = uuidv4();
    }
    
    const referrerUrl = req.headers.referer || null;

    // Create engagement record
    await prisma.engagement.create({
      data: {
        creatorId: post.userId,
        viewerId: viewerId || null,
        postId: Number(postId),
        type: 'post_view',
        ipAddress: String(ip) || null,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        location: location ? JSON.stringify(location) : null,
        sessionId,
        referrerUrl: referrerUrl ? String(referrerUrl) : null,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          fullUrl: req.originalUrl
        })
      }
    });

    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId: post.userId,
          date: today,
          type: 'post_views'
        }
      },
      update: {
        count: { increment: 1 }
      },
      create: {
        creatorId: post.userId,
        date: today,
        type: 'post_views',
        count: 1
      }
    });

    res.status(200).json({ success: true, message: 'Post view tracked' });
  } catch (error) {
    console.error('Error tracking post view:', error);
    res.status(500).json({ error: 'Failed to track post view' });
  }
};

/**
 * Handle tracking audio plays with enhanced metadata and duration
 */
export const handleTrackAudioPlay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { duration } = req.body;
    const viewerId = (req as AuthRequest).user?.userId;

    // Validate duration if provided
    const playDuration = duration ? Number(duration) : null;
    if (duration !== undefined && (isNaN(playDuration!) || playDuration! < 0)) {
      res.status(400).json({ error: 'Invalid duration' });
      return;
    }

    // Get post details to identify creator
    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      select: { userId: true }
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Get metadata information
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'];
    const deviceInfo = userAgent ? parseUserAgent(userAgent) : null;
    const location = ip ? getLocationFromIp(String(ip)) : null;
    
    let sessionId = req.cookies?.session_id;
    if (!sessionId) {
      sessionId = uuidv4();
    }
    
    const referrerUrl = req.headers.referer || null;

    // Create engagement record
    await prisma.engagement.create({
      data: {
        creatorId: post.userId,
        viewerId: viewerId || null,
        postId: Number(postId),
        type: 'audio_play',
        duration: playDuration,
        ipAddress: String(ip) || null,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        location: location ? JSON.stringify(location) : null,
        sessionId,
        referrerUrl: referrerUrl ? String(referrerUrl) : null,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          fullUrl: req.originalUrl,
          playDuration
        })
      }
    });

    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId: post.userId,
          date: today,
          type: 'audio_plays'
        }
      },
      update: {
        count: { increment: 1 },
        totalDuration: { increment: playDuration || 0 }
      },
      create: {
        creatorId: post.userId,
        date: today,
        type: 'audio_plays',
        count: 1,
        totalDuration: playDuration || 0
      }
    });

    res.status(200).json({ success: true, message: 'Audio play tracked' });
  } catch (error) {
    console.error('Error tracking audio play:', error);
    res.status(500).json({ error: 'Failed to track audio play' });
  }
};

/**
 * Handle tracking click-throughs (e.g., from post to profile) with enhanced metadata
 */
export const handleTrackClickThrough = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceType, sourceId, destinationType, destinationId } = req.body;
    const viewerId = (req as AuthRequest).user?.userId;

    // Validate required fields
    if (!sourceType || !sourceId || !destinationType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get creator ID based on source type
    let creatorId: number;
    
    if (sourceType === 'post') {
      const post = await prisma.post.findUnique({
        where: { id: Number(sourceId) },
        select: { userId: true }
      });
      
      if (!post) {
        res.status(404).json({ error: 'Source post not found' });
        return;
      }
      
      creatorId = post.userId;
    } else if (sourceType === 'profile') {
      creatorId = Number(sourceId);
    } else {
      res.status(400).json({ error: 'Invalid source type' });
      return;
    }

    // Get metadata information
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'];
    const deviceInfo = userAgent ? parseUserAgent(userAgent) : null;
    const location = ip ? getLocationFromIp(String(ip)) : null;
    
    let sessionId = req.cookies?.session_id;
    if (!sessionId) {
      sessionId = uuidv4();
    }
    
    const referrerUrl = req.headers.referer || null;
    const exitUrl = req.body.exitUrl || null;

    // Create engagement record
    await prisma.engagement.create({
      data: {
        creatorId,
        viewerId: viewerId || null,
        postId: sourceType === 'post' ? Number(sourceId) : null,
        sourceId: Number(sourceId),
        type: 'click_through',
        ipAddress: String(ip) || null,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : null,
        location: location ? JSON.stringify(location) : null,
        sessionId,
        referrerUrl: referrerUrl ? String(referrerUrl) : null,
        exitUrl: exitUrl ? String(exitUrl) : null,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          sourceType,
          destinationType,
          destinationId: destinationId || null,
          fullUrl: req.originalUrl
        })
      }
    });

    // Update daily analytics
    const today = new Date().toISOString().split('T')[0];
    
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId,
          date: today,
          type: 'click_throughs'
        }
      },
      update: {
        count: { increment: 1 }
      },
      create: {
        creatorId,
        date: today,
        type: 'click_throughs',
        count: 1
      }
    });

    res.status(200).json({ success: true, message: 'Click-through tracked' });
  } catch (error) {
    console.error('Error tracking click-through:', error);
    res.status(500).json({ error: 'Failed to track click-through' });
  }
};

/**
 * Get enhanced analytics for a creator with device/location breakdowns and engagement metrics
 */
export const handleGetCreatorAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get creator ID from params or from logged-in user
    let creatorId = req.params.creatorId ? Number(req.params.creatorId) : null;
    
    if (!creatorId && req.user) {
      const userWithProfile = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { creatorProfile: true }
      });
      
      if (userWithProfile?.role === 'creator') {
        creatorId = userWithProfile.id;
      }
    }
    
    if (!creatorId) {
      res.status(400).json({ error: 'Creator ID is required' });
      return;
    }
    
    // Get date range from query params
    const { startDate, endDate } = req.query;
    const start = startDate ? String(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate ? String(endDate) : new Date().toISOString().split('T')[0];
    
    // Get analytics data for the date range
    const analyticsData = await prisma.analyticsData.findMany({
      where: {
        creatorId,
        date: {
          gte: start,
          lte: end
        }
      }
    });
    
    // Get raw engagement data for detailed analysis
    const engagements = await prisma.engagement.findMany({
      where: {
        creatorId,
        createdAt: {
          gte: new Date(start),
          lte: new Date(`${end}T23:59:59.999Z`)
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // Process analytics data into summary metrics
    const summary = {
      profileViews: 0,
      postViews: 0,
      audioPlays: 0,
      clickThroughs: 0,
      clickThroughRate: 0,
      totalEngagementTime: 0,
      avgEngagementTime: 0,
      uniqueVisitors: new Set(),
      deviceBreakdown: {
        desktop: 0,
        mobile: 0,
        tablet: 0,
        other: 0
      },
      locationBreakdown: {} as Record<string, number>,
      referrerBreakdown: {} as Record<string, number>
    };
    
    // Process daily data
    const dailyData: Record<string, Record<string, number>> = {};
    
    // Initialize daily data structure for the date range
    let currentDate = new Date(start);
    const endDateTime = new Date(end);
    while (currentDate <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailyData[dateStr] = {
        profile_views: 0,
        post_views: 0,
        audio_plays: 0,
        click_throughs: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fill in analytics data
    analyticsData.forEach(data => {
      switch(data.type) {
        case 'profile_views':
          summary.profileViews += data.count;
          dailyData[data.date].profile_views = data.count;
          break;
        case 'post_views':
          summary.postViews += data.count;
          dailyData[data.date].post_views = data.count;
          break;
        case 'audio_plays':
          summary.audioPlays += data.count;
          summary.totalEngagementTime += data.totalDuration || 0;
          dailyData[data.date].audio_plays = data.count;
          break;
        case 'click_throughs':
          summary.clickThroughs += data.count;
          dailyData[data.date].click_throughs = data.count;
          break;
      }
    });
    
    // Process engagement data for detailed metrics
    engagements.forEach(engagement => {
      // Track unique visitors
      if (engagement.ipAddress) {
        summary.uniqueVisitors.add(engagement.ipAddress);
      }
      
      // Device breakdown
      if (engagement.deviceInfo) {
        try {
          const deviceData = JSON.parse(engagement.deviceInfo);
          const deviceType = deviceData.device || 'other';
          
          if (deviceType === 'desktop') summary.deviceBreakdown.desktop++;
          else if (deviceType === 'mobile') summary.deviceBreakdown.mobile++;
          else if (deviceType === 'tablet') summary.deviceBreakdown.tablet++;
          else summary.deviceBreakdown.other++;
        } catch (e) {
          // Handle parse error
        }
      }
      
      // Location breakdown
      if (engagement.location) {
        try {
          const locationData = JSON.parse(engagement.location);
          const country = locationData.country || 'Unknown';
          
          if (!summary.locationBreakdown[country]) {
            summary.locationBreakdown[country] = 0;
          }
          summary.locationBreakdown[country]++;
        } catch (e) {
          // Handle parse error
        }
      }
      
      // Referrer breakdown
      if (engagement.referrerUrl) {
        try {
          // Extract domain from referrer URL
          const url = new URL(engagement.referrerUrl);
          const domain = url.hostname;
          
          if (!summary.referrerBreakdown[domain]) {
            summary.referrerBreakdown[domain] = 0;
          }
          summary.referrerBreakdown[domain]++;
        } catch (e) {
          // Handle URL parse error
        }
      }
    });
    
    // Calculate average engagement time
    if (summary.audioPlays > 0) {
      summary.avgEngagementTime = summary.totalEngagementTime / summary.audioPlays;
    }
    
    // Calculate click-through rate
    if (summary.postViews > 0) {
      summary.clickThroughRate = summary.clickThroughs / summary.postViews;
    }
    
    // Return the comprehensive analytics
    res.status(200).json({
      summary: {
        ...summary,
        uniqueVisitors: summary.uniqueVisitors.size,
        dateRange: { startDate: start, endDate: end }
      },
      dailyData,
      // Add normalized percentages for charts
      charts: {
        deviceBreakdown: Object.entries(summary.deviceBreakdown).map(([device, count]) => ({
          device,
          count,
          percentage: (count / engagements.length * 100).toFixed(1)
        })),
        locationBreakdown: Object.entries(summary.locationBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([country, count]) => ({
            country,
            count,
            percentage: (count / engagements.length * 100).toFixed(1)
          })),
        referrerBreakdown: Object.entries(summary.referrerBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([domain, count]) => ({
            domain,
            count,
            percentage: (count / engagements.length * 100).toFixed(1)
          }))
      }
    });
  } catch (error) {
    console.error('Error fetching creator analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
};

export default {
  handleTrackProfileView,
  handleTrackPostView,
  handleTrackAudioPlay,
  handleTrackClickThrough,
  handleGetCreatorAnalytics
}; 