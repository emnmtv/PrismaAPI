import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import axios from 'axios';

const prisma = new PrismaClient();
const JWT_SECRET = 'your_jwt_secret'; // Replace with a strong secret key


const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
};
// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services like SendGrid or Outlook
  auth: {
    user: '202210258@gordoncollege.edu.ph', // Your email
    pass: 'etjn pufg svxe bbzt',   // App password or email password
  },
});

// Function to send email
const sendVerificationEmail = async (email: string, verificationCode: string) => {
  const mailOptions = {
    from: 'your-email@example.com', // Sender's email
    to: email,                      // Recipient's email
    subject: 'Your Verification Code',
    text: `One Time Verification Code: ${verificationCode}`,
  };

  await transporter.sendMail(mailOptions);
};
// Register a new user with role
const registerUser = async (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  phoneNumber?: string,
  address?: string,
  dateOfBirth?: Date,
  role: string = 'user'  // Default role is 'user'
) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = generateVerificationCode();

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth,
      verificationCode,
      verified: false, // User is initially unverified
      role,            // Assign the provided role
    },
  });

  // Send the verification code via email
  await sendVerificationEmail(email, verificationCode);

  return user;
};

// Login User
const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.verified) {
    throw new Error('Email not verified. Please verify your email to log in.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid password');
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24hrs' });
  return token;
};

// Fetch Profile
const fetchProfile = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      address: true,
      dateOfBirth: true,
      role: true,
      profilePicture: true,
      coverPhoto: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Return the raw data without modifying paths
  return user;
};

// Update a user's profile
const updateUserProfile = async (
  userId: number,
  firstName?: string,
  lastName?: string,
  phoneNumber?: string,
  address?: string,
  dateOfBirth?: Date,
  profilePicture?: string,  // This will be the filename
  coverPhoto?: string       // This will be the filename
) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth,
      profilePicture,
      coverPhoto,
    },
  });

  // Return the raw data
  return updatedUser;
};


const upgradeToCreator = async (
  userId: number,
  offers: string,
  bio?: string,
  profession?: string,
  typeOfProfession?: string,
  genre?: string,
  portfolioFile?: string,
  resumeFile?: string,
  socialLinks?: Array<{ platform: string; url: string; }>
) => {
  // Validate social links (maximum 5)
  if (socialLinks && socialLinks.length > 5) {
    throw new Error('Maximum 5 social media links allowed');
  }

  // Start a transaction
  return await prisma.$transaction(async (prisma) => {
    // Update user role and get updated user
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'creator' },
    });

    // Create Creator Profile
    const creatorProfile = await prisma.creatorProfile.create({
      data: {
        userId,
        offers,
        bio,
        profession,
        typeOfProfession,
        genre,
        creatorLevel: 0, // Start with 0 rating
        portfolioFile,
        resumeFile,
      },
    });

    // Add social media links if provided
    if (socialLinks && socialLinks.length > 0) {
      await prisma.socialMediaLink.createMany({
        data: socialLinks.map(link => ({
          creatorProfileId: creatorProfile.id,
          platform: link.platform,
          url: link.url,
        })),
      });
    }

    // Return the creator profile with social links and user info
    return await prisma.creatorProfile.findUnique({
      where: { id: creatorProfile.id },
      include: {
        socialLinks: true,
        user: true,
      },
    });
  });
};

// Add a new function to update creator level based on ratings and engagement
const updateCreatorLevel = async (creatorId: number) => {
  // Get all ratings for the creator
  const ratings = await prisma.rating.findMany({
    where: {
      userId: creatorId,
    },
  });

  // Calculate average rating
  const averageRating = ratings.length > 0
    ? ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length
    : 0;

  // Get total number of completed orders
  const completedOrders = await prisma.payment.count({
    where: {
      userId: creatorId,
      status: 'paid',
      orderStatus: 'completed',
    },
  });

  // Calculate engagement score (0-5) based on completed orders
  // You can adjust this formula based on your needs
  const engagementScore = Math.min(completedOrders / 10, 5); // Max out at 5 after 50 orders

  // Calculate final creator level (average of rating and engagement)
  const creatorLevel = (averageRating + engagementScore) / 2;

  // Update creator profile with new level
  await prisma.creatorProfile.update({
    where: { userId: creatorId },
    data: { creatorLevel },
  });

  return creatorLevel;
};

// Function to edit the Creator Profile
const editCreatorProfile = async (
  userId: number,
  offers?: string,
  bio?: string,
  profession?: string,
  typeOfProfession?: string,
  genre?: string,
  portfolioFile?: string,
  resumeFile?: string,
  socialLinks?: Array<{ platform: string; url: string; }>
) => {
  // Ensure 'offers' is a valid string, if not, throw an error
  if (!offers) {
    throw new Error('The offers field is required');
  }

  // Start a transaction to handle social links update
  return await prisma.$transaction(async (prisma) => {
    // Update Creator Profile
    const updatedProfile = await prisma.creatorProfile.update({
      where: { userId },
      data: {
        offers,
        bio: bio || undefined,
        profession: profession || undefined,
        typeOfProfession: typeOfProfession || undefined,
        genre: genre || undefined,
        portfolioFile: portfolioFile || undefined,
        resumeFile: resumeFile || undefined,
      },
    });

    // If social links are provided, update them
    if (socialLinks) {
      // Delete existing social links
      await prisma.socialMediaLink.deleteMany({
        where: { creatorProfileId: updatedProfile.id }
      });

      // Add new social links
      if (socialLinks.length > 0) {
        await prisma.socialMediaLink.createMany({
          data: socialLinks.map(link => ({
            creatorProfileId: updatedProfile.id,
            platform: link.platform,
            url: link.url,
          })),
        });
      }
    }

    // Return the updated profile with social links and user info
    return await prisma.creatorProfile.findUnique({
      where: { id: updatedProfile.id },
      include: {
        socialLinks: true,
        user: true,
      },
    });
  });
};

const createPost = async (
  userId: number,
  title: string,
  description: string,
  detailedDescription?: string,
  amount?: string, // Accept amount as string from the frontend
  remarks?: string,
  image?: string,
  video?: string,
  audio?: string // New parameter for audio files
) => {
  try {
    // Convert amount to Float
    const amountAsFloat = amount ? parseFloat(amount) : null;

    // Check for audio file and run copyright detection if present
    let copyrightInfo = null;
    if (audio) {
      copyrightInfo = await checkAudioCopyright(audio);
    }

    // Create the new post
    const newPost = await prisma.post.create({
      data: {
        userId,
        title,
        description,
        detailedDescription,
        amount: amountAsFloat, // Use the converted Float value
        remarks,
        image,
        video,
        audio, // Add audio field
        copyrightInfo: copyrightInfo ? JSON.stringify(copyrightInfo) : null // Store copyright info
      },
    });

    return newPost;
  } catch (error: unknown) {
    // Check if the error is an instance of Error and access the message
    if (error instanceof Error) {
      throw new Error(error.message || 'Failed to create post');
    }
    throw new Error('An unknown error occurred');
  }
};

// Function to check audio copyright using AudD.io API
const checkAudioCopyright = async (audioFilePath: string): Promise<any> => {
  try {
    const AUDD_API_KEY = process.env.AUDD_API_KEY || '4df708e6bbbd879d4c501530c751b0f9'; // Replace with your actual API key
    const fs = require('fs');
    const FormData = require('form-data');
    const axios = require('axios');
    
    // Check file size before sending
    const fileStats = fs.statSync(`uploads/audio/${audioFilePath}`);
    const fileSizeInMB = fileStats.size / (1024 * 1024);
    
    // If file is too large, return early with a warning
    if (fileSizeInMB > 20) {
      console.warn(`Audio file ${audioFilePath} is too large (${fileSizeInMB.toFixed(2)}MB). Skipping copyright check.`);
      return {
        isDetected: false,
        error: 'File too large for copyright detection',
        warning: 'File size exceeds the 20MB limit for copyright detection service. Please upload smaller files for accurate copyright detection.'
      };
    }

    // Create a form data object
    const formData = new FormData();
    formData.append('file', fs.createReadStream(`uploads/audio/${audioFilePath}`));
    formData.append('api_token', AUDD_API_KEY);
    formData.append('return', 'apple_music,spotify,musicbrainz,deezer');

    // Make the API request with timeout to prevent long-running requests
    const response = await axios.post('https://api.audd.io/', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout
    });

    if (response.data.status === 'error') {
      console.error('AudD API error:', response.data.error);
      return {
        isDetected: false,
        error: response.data.error.error_message,
      };
    }

    // Check if a song was recognized
    if (response.data.result) {
      return {
        isDetected: true,
        songInfo: {
          title: response.data.result.title,
          artist: response.data.result.artist,
          album: response.data.result.album,
          releaseDate: response.data.result.release_date,
          label: response.data.result.label,
          timecode: response.data.result.timecode,
          songLink: response.data.result.song_link
        },
        services: {
          appleMusic: response.data.result.apple_music,
          spotify: response.data.result.spotify,
          musicbrainz: response.data.result.musicbrainz,
          deezer: response.data.result.deezer
        }
      };
    } else {
      // No copyright detected
      return {
        isDetected: false
      };
    }
  } catch (error: any) {
    console.error('Error checking audio copyright:', error);
    
    // Handle specific case of request entity too large (413)
    if (error.response && error.response.status === 413) {
      return {
        isDetected: false,
        error: 'File too large for copyright detection service',
        warning: 'Please compress audio files or use smaller files (under 20MB) for copyright detection.'
      };
    }
    
    return {
      isDetected: false,
      error: 'Error connecting to copyright detection service',
      message: error.message || 'Unknown error'
    };
  }
};

// authUtils.ts
export const updatePost = async (
  postId: number,
  title: string,
  description: string,
  detailedDescription?: string,
  amount?: number,
  remarks?: string,
  image?: string,
  video?: string,
  audio?: string // Add audio parameter
) => {
  try {
    // Get the existing post to check if audio has changed
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { audio: true, copyrightInfo: true }
    });

    if (!existingPost) {
      throw new Error('Post not found');
    }

    // If audio file has changed, check for copyright
    let copyrightInfo = existingPost.copyrightInfo;
    if (audio && audio !== existingPost.audio) {
      // Audio file has been updated, check for copyright
      copyrightInfo = await checkAudioCopyright(audio);
      // Convert copyright info to string for storage
      copyrightInfo = copyrightInfo ? JSON.stringify(copyrightInfo) : null;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        description,
        detailedDescription,
        amount,
        remarks,
        image,
        video,
        audio, // Add audio file to update
        copyrightInfo, // Update copyright info if audio has changed
      },
    });

    return updatedPost;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update post: ${error.message}`);
    }
    throw new Error('Failed to update post: Unknown error');
  }
};
// authUtils.ts
export const deletePost = async (postId: number) => {
  try {
    await prisma.post.delete({
      where: { id: postId },
    });
  } catch (error) {
    throw new Error('Failed to delete post');
  }
};

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1/links'; // PayMongo API URL

// Encode the API key in Base64
const apiKey = 'sk_test_wot9ap8ESEBzf3RUB7m7zPRr';
const base64ApiKey = Buffer.from(apiKey + ':').toString('base64');

// Function to create a payment link
export const createPaymentLink = async (amount: number, description: string, remarks: string, clientId: string): Promise<{ checkoutUrl: string; referenceNumber: string; status: string; }> => {
  try {
    const response = await axios.post(
      PAYMONGO_API_URL,
      {
        data: {
          attributes: {
            amount: amount, // amount in the smallest unit (e.g., cents)
            description: description,
            remarks: remarks,
            clientId: clientId, // Include clientId in the request
          },
        },
      },
      {
        headers: {
          accept: 'application/json',
          authorization: `Basic ${base64ApiKey}`, // Use the Base64-encoded API key
          'content-type': 'application/json',
        },
      }
    );

    // Log the response
    console.log('Payment link response:', response.data);

    // Extract relevant data from the response
    const { data } = response.data;
    const paymentLink = {
      checkoutUrl: data.attributes.checkout_url,
      referenceNumber: data.attributes.reference_number,
      status: data.attributes.status,
    };

    // Return the payment link details
    return paymentLink;
  } catch (error: any) {
    console.error('Error creating payment link:', error);
    throw new Error('Failed to create payment link');
  }
};

// Add this function to check payment status
export const checkPaymentStatus = async (referenceNumber: string) => {
  const apiKey = 'sk_test_wot9ap8ESEBzf3RUB7m7zPRr'; // Ensure this is your correct API key
  const base64ApiKey = Buffer.from(apiKey + ':').toString('base64'); // Ensure correct Base64 encoding

  const options = {
    method: 'GET',
    url: `https://api.paymongo.com/v1/links?reference_number=${referenceNumber}`,
    headers: {
      accept: 'application/json',
      authorization: `Basic ${base64ApiKey}`, // Use the Base64-encoded API key
    },
  };

  try {
    const response = await axios.request(options);
    console.log('API Response:', response.data); // Log the entire response

    // Check if the response contains an error
    if (response.data.errors) {
      throw new Error(`PayMongo API Error: ${JSON.stringify(response.data.errors)}`);
    }

    const paymentData = response.data.data;

    // Check if paymentData is an array and has at least one element
    if (!Array.isArray(paymentData) || paymentData.length === 0) {
      throw new Error('No payment data found in the response');
    }

    // Access the first element of the array
    const attributes = paymentData[0].attributes;

    // Log the attributes object to see its contents
    console.log('Attributes:', attributes); // Log the attributes object

    // Check if attributes exist
    if (!attributes) {
      throw new Error('Invalid response structure from PayMongo API');
    }

    // Return the payment status
    return attributes.status; // Ensure that 'status' exists in attributes
  } catch (error) {
    console.error('Error checking payment status:', error);
    throw new Error('Failed to check payment status');
  }
};

// Function to fetch payments for a user
export const fetchPaymentsForUser = async (userId: number) => {
  const payments = await prisma.payment.findMany({
    where: {
      userId: userId, // Fetch payments for the authenticated user
    },
    include: {
      client: true, // Include client details
    },
  });

  return payments;
};

// Function to update the order status of a payment
export const updateOrderStatus = async (referenceNumber: string, newStatus: string) => {
  const updatedPayment = await prisma.payment.update({
    where: { referenceNumber: referenceNumber },
    data: { orderStatus: newStatus }, // Update the order status
  });

  return updatedPayment;
};

// Function to fetch payments for a client
export const fetchPaymentsForClient = async (clientId: number) => {
  const payments = await prisma.payment.findMany({
    where: {
      clientId: clientId, // Fetch payments for the specified client
    },
    include: {
      user: true, // Include user details if needed
    },
  });

  return payments;
};

// Function to update the order status of a payment from the client side
export const updateOrderStatusForClient = async (clientId: number, referenceNumber: string, newStatus: string) => {
  const updatedPayment = await prisma.payment.updateMany({
    where: {
      clientId: clientId,
      referenceNumber: referenceNumber,
    },
    data: { orderStatus: newStatus }, // Update the order status
  });

  return updatedPayment;
};

// Function to create or update a rating
export const rateCreator = async (
  clientId: number,
  userId: number,
  paymentId: number,
  rating: number,
  review?: string
) => {
  try {
    // Validate rating value
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if payment exists and belongs to the client
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        clientId: clientId,
        userId: userId,
        status: 'paid',
        orderStatus: 'completed'
      }
    });

    if (!payment) {
      throw new Error('Payment not found or not eligible for rating');
    }

    // Create or update rating
    const ratingRecord = await prisma.rating.upsert({
      where: {
        paymentId: paymentId
      },
      update: {
        rating: rating,
        review: review,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        clientId: clientId,
        paymentId: paymentId,
        rating: rating,
        review: review
      }
    });

    // Update creator level after new rating
    const newCreatorLevel = await updateCreatorLevel(userId);

    return {
      rating: ratingRecord,
      creatorLevel: newCreatorLevel
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to submit rating: ${error.message}`);
    }
    throw new Error('Failed to submit rating: Unknown error occurred');
  }
};

// Function to get creator's ratings
export const getCreatorRatings = async (userId: number) => {
  try {
    // Validate userId
    if (!userId || typeof userId !== 'number') {
      throw new Error('Invalid userId provided');
    }

    // Get all ratings for the creator
    const ratings = await prisma.rating.findMany({
      where: {
        userId: {
          equals: userId // Specify the equals operator explicitly
        }
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        payment: {
          select: {
            description: true,
            amount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get aggregated stats
    const stats = await prisma.rating.aggregate({
      where: {
        userId: {
          equals: userId
        }
      },
      _avg: {
        rating: true
      },
      _count: {
        _all: true // Count all ratings
      }
    });

    return {
      ratings,
      stats: {
        average: stats._avg.rating || 0,
        total: stats._count._all || 0
      }
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch ratings: ${error.message}`);
    }
    throw new Error('Failed to fetch ratings: Unknown error occurred');
  }
};

// Function to approve/reject post
export const updatePostStatus = async (postId: number, status: string, adminId: number) => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can perform this action');
    }

    return await prisma.post.update({
      where: { id: postId },
      data: { 
        status: status,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to update post status: ${error.message}`);
    }
    throw new Error('Failed to update post status: Unknown error occurred');
  }
};

// Function to delete post (admin only)
export const deletePostAdmin = async (postId: number, adminId: number) => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId }
    });

    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can perform this action');
    }

    return await prisma.post.delete({
      where: { id: postId }
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete post: ${error.message}`);
    }
    throw new Error('Failed to delete post: Unknown error occurred');
  }
};

// Function to fetch all users
export const fetchAllUsers = async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        address: true,
        dateOfBirth: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        creatorProfile: true, // Include creator profile if exists
        _count: {
          select: {
            posts: true, // Count of posts
            payments: true, // Count of payments
            clientPayments: true // Count of client payments
          }
        }
      }
    });

    return users;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    throw new Error('Failed to fetch users: Unknown error occurred');
  }
};

// Function to get creator's ratings by ID (viewable by any user)
export const getCreatorRatingsByCreatorId = async (creatorId: number) => {
  try {
    // Validate creatorId
    if (!creatorId || typeof creatorId !== 'number') {
      throw new Error('Invalid creatorId provided');
    }

    // Get all ratings for the specified creator
    const ratings = await prisma.rating.findMany({
      where: {
        userId: creatorId
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        payment: {
          select: {
            description: true,
            amount: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get aggregated stats
    const stats = await prisma.rating.aggregate({
      where: {
        userId: creatorId
      },
      _avg: {
        rating: true
      },
      _count: {
        _all: true // Count all ratings
      }
    });

    return {
      ratings,
      stats: {
        average: stats._avg.rating || 0,
        total: stats._count._all || 0
      }
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch ratings: ${error.message}`);
    }
    throw new Error('Failed to fetch ratings: Unknown error occurred');
  }
};

// ==================== ENGAGEMENT TRACKING FUNCTIONS ====================

// Track profile view
export const trackProfileView = async (creatorId: number, viewerId?: number) => {
  try {
    // Create an engagement record for profile view
    const engagement = await prisma.engagement.create({
      data: {
        creatorId,
        viewerId,
        type: 'profile_view',
      },
    });
    
    // Update profile view count
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId,
          date: new Date().toISOString().split('T')[0],
          type: 'profile_views',
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        creatorId,
        date: new Date().toISOString().split('T')[0],
        type: 'profile_views',
        count: 1,
      },
    });

    return engagement;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to track profile view: ${error.message}`);
    }
    throw new Error('Failed to track profile view');
  }
};

// Track post view
export const trackPostView = async (postId: number, viewerId?: number) => {
  try {
    // Get the post to find creatorId
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    const creatorId = post.userId;

    // Create an engagement record for post view
    const engagement = await prisma.engagement.create({
      data: {
        creatorId,
        postId,
        viewerId,
        type: 'post_view',
      },
    });
    
    // Update post view count
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId,
          date: new Date().toISOString().split('T')[0],
          type: 'post_views',
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        creatorId,
        date: new Date().toISOString().split('T')[0],
        type: 'post_views',
        count: 1,
      },
    });

    return engagement;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to track post view: ${error.message}`);
    }
    throw new Error('Failed to track post view');
  }
};

// Track audio playback
export const trackAudioPlay = async (postId: number, viewerId?: number, duration?: number) => {
  try {
    // Get the post to find creatorId
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    const creatorId = post.userId;

    // Create an engagement record for audio play
    const engagement = await prisma.engagement.create({
      data: {
        creatorId,
        postId,
        viewerId,
        type: 'audio_play',
        duration,
      },
    });
    
    // Update audio play count
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId,
          date: new Date().toISOString().split('T')[0],
          type: 'audio_plays',
        },
      },
      update: {
        count: { increment: 1 },
        totalDuration: { increment: duration || 0 },
      },
      create: {
        creatorId,
        date: new Date().toISOString().split('T')[0],
        type: 'audio_plays',
        count: 1,
        totalDuration: duration || 0,
      },
    });

    return engagement;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to track audio play: ${error.message}`);
    }
    throw new Error('Failed to track audio play');
  }
};

// Track click-through (e.g., from post to profile, or profile to contact)
export const trackClickThrough = async (sourceType: 'post' | 'profile', sourceId: number, destinationType: string, viewerId?: number) => {
  try {
    // Determine creatorId based on sourceType
    let creatorId: number;
    
    if (sourceType === 'post') {
      const post = await prisma.post.findUnique({
        where: { id: sourceId },
        select: { userId: true },
      });
      
      if (!post) {
        throw new Error('Source post not found');
      }
      
      creatorId = post.userId;
    } else {
      // Source is a profile
      creatorId = sourceId;
    }

    // Create engagement record for click-through
    const engagement = await prisma.engagement.create({
      data: {
        creatorId,
        sourceId,
        viewerId,
        type: 'click_through',
        metadata: JSON.stringify({
          sourceType,
          destinationType,
        }),
      },
    });
    
    // Update click-through count
    await prisma.analyticsData.upsert({
      where: {
        creatorId_date_type: {
          creatorId,
          date: new Date().toISOString().split('T')[0],
          type: `click_through_${sourceType}_to_${destinationType}`,
        },
      },
      update: {
        count: { increment: 1 },
      },
      create: {
        creatorId,
        date: new Date().toISOString().split('T')[0],
        type: `click_through_${sourceType}_to_${destinationType}`,
        count: 1,
      },
    });

    return engagement;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to track click-through: ${error.message}`);
    }
    throw new Error('Failed to track click-through');
  }
};

// Get creator engagement analytics summary
export const getCreatorAnalytics = async (creatorId: number, startDate?: string, endDate?: string) => {
  try {
    // Set default date range to last 30 days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate 
      ? new Date(startDate) 
      : new Date(end);
    
    if (!startDate) {
      start.setDate(start.getDate() - 30); // Default to last 30 days
    }

    // Format dates for query
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];

    // Get all analytics data within date range
    const analyticsData = await prisma.analyticsData.findMany({
      where: {
        creatorId,
        date: {
          gte: formattedStartDate,
          lte: formattedEndDate,
        },
      },
    });

    // Calculate engagement metrics
    const profileViews = analyticsData
      .filter(data => data.type === 'profile_views')
      .reduce((sum, data) => sum + data.count, 0);
    
    const postViews = analyticsData
      .filter(data => data.type === 'post_views')
      .reduce((sum, data) => sum + data.count, 0);
    
    const audioPlays = analyticsData
      .filter(data => data.type === 'audio_plays')
      .reduce((sum, data) => sum + data.count, 0);
    
    const totalPlayTime = analyticsData
      .filter(data => data.type === 'audio_plays')
      .reduce((sum, data) => sum + (data.totalDuration || 0), 0);
    
    const clickThroughs = analyticsData
      .filter(data => data.type.startsWith('click_through_'))
      .reduce((sum, data) => sum + data.count, 0);
    
    // Calculate derived metrics
    const avgPlayTime = audioPlays > 0 ? totalPlayTime / audioPlays : 0;
    const clickThroughRate = postViews > 0 ? clickThroughs / postViews : 0;

    // Get daily data for charts
    const dailyData = analyticsData.reduce((acc, data) => {
      if (!acc[data.date]) {
        acc[data.date] = {};
      }
      acc[data.date][data.type] = data.count;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    return {
      summary: {
        profileViews,
        postViews,
        audioPlays,
        totalPlayTime,
        avgPlayTime,
        clickThroughs,
        clickThroughRate,
      },
      dailyData,
      dateRange: {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get creator analytics: ${error.message}`);
    }
    throw new Error('Failed to get creator analytics');
  }
};

export { registerUser, 
  loginUser, fetchProfile, 
  updateUserProfile, prisma, 
  upgradeToCreator,
  updateCreatorLevel,
  editCreatorProfile,
  createPost,
};