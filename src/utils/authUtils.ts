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
    pass: 'dwhz hemi nozz jjwh',   // App password or email password
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

// Function to send notification email
const sendNotificationEmail = async (email: string, subject: string, message: string) => {
  const mailOptions = {
    from: 'your-email@example.com', // Sender's email
    to: email,                      // Recipient's email
    subject: subject,
    html: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Notification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send notification email:', error);
    return false;
  }
};

// Create notification in database
const createNotification = async (
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedId?: number,
  metadata?: any
) => {
  try {
    // Limit the size of metadata by removing large objects if present
    let metadataString = null;
    if (metadata) {
      // If there's copyrightInfo containing large objects, simplify it
      if (metadata.copyrightInfo) {
        // Create a simplified version with just essential info
        const simplifiedCopyrightInfo = {
          isDetected: metadata.copyrightInfo.isDetected,
          songInfo: metadata.copyrightInfo.songInfo ? {
            title: metadata.copyrightInfo.songInfo.title || 'Unknown',
            artist: metadata.copyrightInfo.songInfo.artist || 'Unknown'
          } : null,
        };
        
        // Replace the original with the simplified version
        metadata.copyrightInfo = simplifiedCopyrightInfo;
      }
      
      // Convert to string and check length
      metadataString = JSON.stringify(metadata);
      
      // If still too long (over 1000 chars), truncate further
      if (metadataString.length > 1000) {
        console.warn(`Metadata too large (${metadataString.length} chars), truncating`);
        // Create minimal metadata with just the essential info
        metadataString = JSON.stringify({
          truncated: true,
          message: "Metadata was too large and has been truncated"
        });
      }
    }
    
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedId,
        metadata: metadataString,
      },
    });
    
    // Get user email to send notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    
    if (user) {
      await sendNotificationEmail(user.email, title, message);
    }
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
};

// Handle copyright strike
const handleCopyrightStrike = async (userId: number, postId: number, copyrightInfo: any) => {
  try {
    // Get current strike count
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        copyrightStrikes: true, 
        email: true,
        firstName: true,
        lastName: true 
      },
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const newStrikeCount = user.copyrightStrikes + 1;
    
    // Update user's copyright strike count
    await prisma.user.update({
      where: { id: userId },
      data: { 
        copyrightStrikes: newStrikeCount,
        // If this is the 5th strike, put account under review
        underReview: newStrikeCount >= 5
      },
    });
    
    // Create a notification
    const songInfo = copyrightInfo.songInfo || {};
    const title = `Copyright Strike #${newStrikeCount}`;
    let message = `<p>We've detected copyright protected content in your recent post for the song: <strong>${songInfo.title || 'Unknown'}</strong> by <strong>${songInfo.artist || 'Unknown'}</strong>.</p>`;
    
    // Add warning based on strike count
    if (newStrikeCount >= 5) {
      message += `<p><span style="color: red; font-weight: bold;">WARNING:</span> This is your 5th copyright strike. Your account is now under review by our administrators. During this time, you may experience limited functionality.</p>`;
    } else {
      message += `<p>This is strike ${newStrikeCount} out of 5 allowed. After 5 strikes, your account will be placed under review.</p>`;
    }
    
    message += `<p>Please be careful about uploading content that may be protected by copyright. If you believe this is a mistake, please contact our support team.</p>`;
    
    await createNotification(
      userId,
      'copyright_strike',
      title,
      message,
      postId,
      { 
        strikeCount: newStrikeCount,
        copyrightInfo 
      }
    );
    
    // If 5 strikes, notify admins
    if (newStrikeCount >= 5) {
      // Find admins to notify
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { id: true, email: true },
      });
      
      // Notify each admin
      for (const admin of admins) {
        const adminMessage = `<p>User ${user.firstName} ${user.lastName} (${user.email}) has received their 5th copyright strike.</p>
        <p>Their account has been automatically flagged for review. Please review this account and take appropriate action.</p>`;
        
        await createNotification(
          admin.id,
          'admin_alert',
          'User Account Review Required',
          adminMessage,
          userId,
          { userId, strikes: newStrikeCount }
        );
      }
    }
    
    return {
      strikes: newStrikeCount,
      underReview: newStrikeCount >= 5
    };
  } catch (error) {
    console.error('Failed to handle copyright strike:', error);
    throw error;
  }
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
  // Check if a user with this email already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });

  // If user exists and is unverified, delete it
  if (existingUser && !existingUser.verified) {
    await prisma.user.delete({
      where: { email }
    });
    // Continue with registration after deleting unverified user
  } else if (existingUser) {
    // If user exists and is verified, throw an error
    throw new Error('Email already in use. Please use a different email or login instead.');
  }

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

  // Check if user is suspended
  if (user.restrictionType === 'suspended') {
    // Check if suspension has expired
    if (user.restrictionExpiresAt && new Date() > new Date(user.restrictionExpiresAt)) {
      // Suspension has expired, remove suspension
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          restrictionType: null,
          restrictionExpiresAt: null
        }
      });
    } else {
      // User is still suspended
      const expiryDate = user.restrictionExpiresAt ? 
        ` until ${new Date(user.restrictionExpiresAt).toLocaleDateString()}` : '';
      throw new Error(`Your account is suspended${expiryDate}. Please contact support for assistance.`);
    }
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

// Function to check audio copyright using AudD.io API
const checkAudioCopyright = async (audioFilePath: string, userId: number): Promise<any> => {
  try {
    const AUDD_API_KEY = process.env.AUDD_API_KEY || '2246f6b0eafc1c3a59fcea1c8242d06b'; // Replace with your actual API key
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
      const copyrightData = {
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
      
      // Handle copyright strike for the user
      await handleCopyrightStrike(userId, 0, copyrightData); // We'll update the postId after post creation
      
      return copyrightData;
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
    // Check if user has restrictions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        restrictionType: true,
        restrictionExpiresAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is restricted from creating posts
    if (user.restrictionType) {
      // Check if restriction has expired
      if (user.restrictionExpiresAt && new Date() > new Date(user.restrictionExpiresAt)) {
        // Restriction has expired, remove it
        await prisma.user.update({
          where: { id: userId },
          data: { 
            restrictionType: null,
            restrictionExpiresAt: null
          }
        });
      } else {
        // User is still restricted
        const expiryDate = user.restrictionExpiresAt ? 
          ` until ${new Date(user.restrictionExpiresAt).toLocaleDateString()}` : '';
        throw new Error(`You are currently restricted from creating new posts${expiryDate} due to a ${user.restrictionType} on your account. Please contact support for assistance.`);
      }
    }

    // Convert amount to Float
    const amountAsFloat = amount ? parseFloat(amount) : null;

    // Check for audio file and run copyright detection if present
    let copyrightInfo = null;
    let copyrightInfoString = null;
    
    if (audio) {
      copyrightInfo = await checkAudioCopyright(audio, userId);
      
      if (copyrightInfo) {
        // Extract only the essential information to reduce size
        const minimizedInfo = {
          isDetected: !!copyrightInfo.isDetected
        };
        
        // Add song info if available and detected
        if (copyrightInfo.isDetected && copyrightInfo.songInfo) {
          Object.assign(minimizedInfo, {
            songInfo: {
              title: copyrightInfo.songInfo.title || 'Unknown',
              artist: copyrightInfo.songInfo.artist || 'Unknown'
            }
          });
        }
        
        // Add warning or error if present
        if (typeof copyrightInfo.warning === 'string') {
          Object.assign(minimizedInfo, { warning: copyrightInfo.warning });
        }
        
        if (typeof copyrightInfo.error === 'string') {
          Object.assign(minimizedInfo, { error: copyrightInfo.error });
        }
        
        // Convert to string
        copyrightInfoString = JSON.stringify(minimizedInfo);
        
        // Check length and truncate if needed
        if (copyrightInfoString && copyrightInfoString.length > 1000) {
          console.warn(`Copyright info too large (${copyrightInfoString.length} chars), truncating`);
          copyrightInfoString = JSON.stringify({
            isDetected: !!copyrightInfo.isDetected,
            truncated: true,
            message: "Copyright info was too large and has been truncated"
          });
        }
      }
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
        copyrightInfo: copyrightInfoString // Store minimized copyright info
      },
    });
    
    // If copyright was detected, update the post ID in the strike record
    if (copyrightInfo && copyrightInfo.isDetected) {
      // Find the notification we just created and update it with correct postId
      await prisma.notification.updateMany({
        where: {
          userId: userId,
          type: 'copyright_strike',
          relatedId: 0 // Temporary ID we used earlier
        },
        data: {
          relatedId: newPost.id
        }
      });
    }

    return newPost;
  } catch (error: unknown) {
    // Check if the error is an instance of Error and access the message
    if (error instanceof Error) {
      throw new Error(error.message || 'Failed to create post');
    }
    throw new Error('An unknown error occurred');
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
      select: { 
        audio: true, 
        copyrightInfo: true,
        userId: true // Get user ID for copyright notifications
      }
    });

    if (!existingPost) {
      throw new Error('Post not found');
    }

    // If audio file has changed, check for copyright
    let copyrightInfo = existingPost.copyrightInfo;
    if (audio && audio !== existingPost.audio) {
      // Audio file has been updated, check for copyright
      const copyrightData = await checkAudioCopyright(audio, existingPost.userId);
      // Convert copyright info to string for storage
      copyrightInfo = copyrightData ? JSON.stringify(copyrightData) : null;
      
      // If copyright was detected, update the strike record with correct postId
      if (copyrightData && copyrightData.isDetected) {
        // Find the notification we just created and update it with correct postId
        await prisma.notification.updateMany({
          where: {
            userId: existingPost.userId,
            type: 'copyright_strike',
            relatedId: 0 // Temporary ID we used earlier
          },
          data: {
            relatedId: postId
          }
        });
      }
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

// Get user notifications
export const getUserNotifications = async (userId: number, limit = 20, offset = 0, includeRead = false) => {
  try {
    const where = {
      userId,
      ...(includeRead ? {} : { read: false })
    };
    
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });
    
    const totalCount = await prisma.notification.count({ where });
    
    return {
      notifications,
      totalCount,
      unreadCount: includeRead 
        ? await prisma.notification.count({ where: { userId, read: false } }) 
        : totalCount
    };
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    throw new Error('Failed to fetch notifications');
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId: number, userId: number) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId // Ensure the notification belongs to the user
      }
    });
    
    if (!notification) {
      throw new Error('Notification not found or does not belong to user');
    }
    
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true }
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw new Error('Failed to update notification');
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId: number) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        read: false
      },
      data: { read: true }
    });
    
    return { count: result.count };
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw new Error('Failed to update notifications');
  }
};

// Admin function to review user after copyright strikes
export const reviewUserCopyrightStatus = async (adminId: number, userId: number, action: 'clear' | 'warn' | 'suspend' | 'unsuspend', duration?: number) => {
  try {
    // Verify admin permissions
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can perform this action');
    }
    
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        email: true, 
        firstName: true,
        lastName: true,
        copyrightStrikes: true,
        role: true
      }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    let updates: any = {
      underReview: false // Clear review flag regardless of action
    };
    
    let notificationTitle = '';
    let notificationMessage = '';
    let expiryDate = null;
    
    // Calculate expiry date if duration is provided
    if (duration && (action === 'warn' || action === 'suspend')) {
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + duration);
      updates.restrictionExpiresAt = expiryDate;
    }
    
    switch (action) {
      case 'clear':
        updates.copyrightStrikes = 0; // Reset strike count
        updates.restrictionExpiresAt = null; // Clear any existing restrictions
        updates.restrictionType = null; // Clear restriction type
        notificationTitle = 'Copyright Strikes Cleared';
        notificationMessage = `<p>After reviewing your account, our administration team has cleared your copyright strikes.</p>
        <p>Your account is now in good standing. Thank you for your cooperation.</p>`;
        break;
        
      case 'warn':
        // Keep current strikes but update warning status
        updates.restrictionType = 'warning';
        notificationTitle = 'Account Review Completed - Warning';
        notificationMessage = `<p>After reviewing your account, our administration team has issued a warning.</p>
        <p>Your copyright strikes remain on record, but your account has been restored to normal operation with restrictions.</p>
        <p>This warning will remain on your account for ${duration} days (until ${expiryDate?.toLocaleDateString()}).</p>
        <p>During this period, you will not be able to create new posts.</p>
        <p>Please be careful about uploading content that may be protected by copyright.</p>`;
        break;
        
      case 'suspend':
        // Note: we don't change the role, just mark them as suspended
        updates.restrictionType = 'suspended';
        notificationTitle = 'Account Suspended';
        notificationMessage = `<p>After reviewing your account and its ${user.copyrightStrikes} copyright violations, our administration team has suspended your account.</p>
        <p>This suspension will last for ${duration} days (until ${expiryDate?.toLocaleDateString()}).</p>
        <p>During this period, you will not be able to log in or use any TuneUp features.</p>
        <p>This decision is due to repeated copyright infringement. If you believe this is a mistake, please contact our support team.</p>`;
        
        // Mark all user's posts as rejected
        await prisma.post.updateMany({
          where: { userId: userId },
          data: { status: 'rejected' }
        });
        break;
        
      case 'unsuspend':
        // Clear any restrictions
        updates.restrictionType = null;
        updates.restrictionExpiresAt = null;
        
        notificationTitle = 'Account Restriction Removed';
        notificationMessage = `<p>Good news! Your account restrictions have been removed by our administration team.</p>
        <p>Your account is now in good standing, and all features have been restored.</p>
        <p>Thank you for your cooperation and understanding.</p>`;
        break;
        
      default:
        throw new Error('Invalid action specified');
    }
    
    // Update user
    await prisma.user.update({
      where: { id: userId },
      data: updates
    });
    
    // Create notification for user
    await createNotification(
      userId,
      'account_review',
      notificationTitle,
      notificationMessage,
      undefined,
      { action, adminId, expiryDate: expiryDate?.toISOString() }
    );
    
    return { 
      success: true, 
      action,
      expiryDate: expiryDate?.toISOString() 
    };
  } catch (error) {
    console.error('Failed to review user:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to review user: ${error.message}`);
    }
    throw new Error('Failed to review user: Unknown error');
  }
};

// Function to generate a reset code for password reset
const generateResetCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
};

// Function to send password reset email
const sendPasswordResetEmail = async (email: string, resetCode: string) => {
  const mailOptions = {
    from: 'your-email@example.com',
    to: email,
    subject: 'Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1877f2;">TuneUp - Password Reset</h2>
        <p>You requested to reset your password. Use the code below to complete the process:</p>
        <div style="background-color: #f0f2f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px;">
          ${resetCode}
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
        <p>Thank you,<br>TuneUp Team</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Function to request password reset
const requestPasswordReset = async (email: string) => {
  // Check if user exists
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('No account found with this email address');
  }

  // Generate reset code and set expiry (15 minutes from now)
  const resetCode = generateResetCode();
  const resetCodeExpiry = new Date();
  resetCodeExpiry.setMinutes(resetCodeExpiry.getMinutes() + 15);

  // Update user with reset code
  await prisma.user.update({
    where: { email },
    data: {
      resetCode,
      resetCodeExpiry,
    },
  });

  // Send reset email
  await sendPasswordResetEmail(email, resetCode);

  return { message: 'Password reset instructions sent to your email' };
};

// Function to verify reset code and update password
const resetPassword = async (email: string, resetCode: string, newPassword: string) => {
  // Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  
  // Check if user exists
  if (!user) {
    throw new Error('No account found with this email address');
  }

  // Check if reset code exists and matches
  if (!user.resetCode || user.resetCode !== resetCode) {
    throw new Error('Invalid reset code');
  }

  // Check if reset code is expired
  if (!user.resetCodeExpiry || new Date() > user.resetCodeExpiry) {
    throw new Error('Reset code has expired. Please request a new one');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update user's password and clear reset code
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      resetCode: null,
      resetCodeExpiry: null,
    },
  });

  return { message: 'Password has been reset successfully' };
};

// Function to apply for creator verification
const applyForVerification = async (
  userId: number,
  validIdDocument: string,
  reason?: string
) => {
  try {
    // Check if user is a creator
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { creatorProfile: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'creator' || !user.creatorProfile) {
      throw new Error('Only creators can apply for verification');
    }

    // Check if creator has already applied or is already verified
    if (user.creatorProfile.isVerified) {
      throw new Error('Creator is already verified');
    }

    // Update creator profile with verification request
    const updatedProfile = await prisma.creatorProfile.update({
      where: { userId },
      data: {
        verificationRequested: true,
        validIdDocument,
        verificationReason: reason || 'Creator verification requested',
        verificationRequestedAt: new Date()
      },
    });

    // Notify all admins about the verification request
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true }
    });

    for (const admin of admins) {
      await createNotification(
        admin.id,
        'verification_request',
        'New Creator Verification Request',
        `<p>Creator ${user.firstName} ${user.lastName} has requested verification.</p>
         <p>Please review their documents and approve or reject this request.</p>`,
        userId,
        { creatorId: userId, profileId: user.creatorProfile.id }
      );
    }

    return updatedProfile;
  } catch (error) {
    console.error('Error applying for verification:', error);
    throw error;
  }
};

// Function for admin to review and verify a creator
const reviewCreatorVerification = async (
  adminId: number,
  creatorProfileId: number,
  approve: boolean,
  rejectionReason?: string
) => {
  try {
    // Verify admin permissions
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    if (!admin || admin.role !== 'admin') {
      throw new Error('Unauthorized: Only admins can verify creators');
    }
    
    // Get creator profile
    const creatorProfile = await prisma.creatorProfile.findUnique({
      where: { id: creatorProfileId },
      include: { user: true }
    });
    
    if (!creatorProfile) {
      throw new Error('Creator profile not found');
    }
    
    // Update verification status
    const updatedProfile = await prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: {
        isVerified: approve,
        verificationRequested: false,
        verificationReviewedAt: new Date(),
        verificationReviewedBy: adminId,
        rejectionReason: !approve ? rejectionReason : null
      }
    });
    
    // Create notification for creator
    const notificationTitle = approve ? 
      'Verification Approved!' : 
      'Verification Request Rejected';
    
    const notificationMessage = approve ?
      `<p>Congratulations! Your verification request has been approved. Your creator profile is now verified.</p>
       <p>Verified creators receive priority in search results and a verification badge on their profiles.</p>` :
      `<p>We're sorry, but your verification request has been rejected.</p>
       <p>Reason: ${rejectionReason || 'No reason provided'}</p>
       <p>You may submit a new verification request after addressing the issues mentioned.</p>`;
    
    await createNotification(
      creatorProfile.userId,
      'verification_review',
      notificationTitle,
      notificationMessage,
      adminId,
      { approved: approve, reviewedBy: adminId }
    );
    
    return {
      profile: updatedProfile,
      approved: approve
    };
  } catch (error) {
    console.error('Error reviewing verification:', error);
    throw error;
  }
};

// Function to get pending verification requests (for admin)
const getPendingVerificationRequests = async () => {
  try {
    const pendingRequests = await prisma.creatorProfile.findMany({
      where: {
        verificationRequested: true,
        isVerified: false
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePicture: true,
            createdAt: true,
            creatorProfile: true,
            posts:{
              select:{
                id:true,
                audio:true,
                copyrightInfo:true,
                createdAt:true,
                updatedAt:true,
                status:true,
                title:true,
                description:true,
                detailedDescription:true,
                amount:true,
                remarks:true,
                image:true,
                video:true,
                
              }
            }
          }
        }
      },
      orderBy: {
        verificationRequestedAt: 'asc' // Oldest first
      }
    });
    
    return pendingRequests;
  } catch (error) {
    console.error('Error fetching verification requests:', error);
    throw error;
  }
};

// Function to periodically recheck copyright for audio files
const recheckCopyright = async () => {
  try {
    console.log('[Copyright Service] Starting scheduled copyright recheck...');
    
    // Find posts with audio files that are older than 1 day and haven't been rechecked in the last 24 hours
    // Limiting to 10 at a time to avoid overloading the service
    const postsToRecheck = await prisma.post.findMany({
      where: {
        audio: { not: null },
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Older than 1 day
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Not updated in the last 24 hours
      },
      select: {
        id: true,
        userId: true,
        audio: true,
        copyrightInfo: true,
      },
      take: 10,
      orderBy: {
        updatedAt: 'asc', // Oldest updated first
      },
    });
    
    if (postsToRecheck.length === 0) {
      console.log('[Copyright Service] No posts need rechecking at this time.');
      return;
    }
    
    console.log(`[Copyright Service] Found ${postsToRecheck.length} posts to recheck.`);
    
    // Recheck each post
    for (const post of postsToRecheck) {
      try {
        console.log(`[Copyright Service] Rechecking post ${post.id}...`);
        
        // Skip if no audio file
        if (!post.audio) {
          console.log(`[Copyright Service] Post ${post.id} has no audio file to check. Skipping.`);
          continue;
        }
        
        // Recheck the audio file
        const newCopyrightInfo = await checkAudioCopyright(post.audio, post.userId);
        
        // Format copyright info for storage
        let copyrightInfoString = null;
        
        if (newCopyrightInfo) {
          // Extract only the essential information to reduce size
          const minimizedInfo = {
            isDetected: !!newCopyrightInfo.isDetected,
            lastChecked: new Date().toISOString(),
            checkCount: 1, // Initialize check count
          };
          
          // Add song info if available and detected
          if (newCopyrightInfo.isDetected && newCopyrightInfo.songInfo) {
            Object.assign(minimizedInfo, {
              songInfo: {
                title: newCopyrightInfo.songInfo.title || 'Unknown',
                artist: newCopyrightInfo.songInfo.artist || 'Unknown'
              }
            });
          }
          
          // Add warning or error if present
          if (typeof newCopyrightInfo.warning === 'string') {
            Object.assign(minimizedInfo, { warning: newCopyrightInfo.warning });
          }
          
          if (typeof newCopyrightInfo.error === 'string') {
            Object.assign(minimizedInfo, { error: newCopyrightInfo.error });
          }
          
          // If previous check exists, increment check count
          try {
            if (post.copyrightInfo) {
              const previousInfo = JSON.parse(post.copyrightInfo);
              if (previousInfo && typeof previousInfo === 'object' && previousInfo.checkCount) {
                minimizedInfo.checkCount = previousInfo.checkCount + 1;
              }
            }
          } catch (e) {
            console.error(`[Copyright Service] Error parsing previous copyright info for post ${post.id}:`, e);
          }
          
          // Convert to string
          copyrightInfoString = JSON.stringify(minimizedInfo);
          
          // Check length and truncate if needed
          if (copyrightInfoString && copyrightInfoString.length > 1000) {
            console.warn(`[Copyright Service] Copyright info too large (${copyrightInfoString.length} chars), truncating`);
            copyrightInfoString = JSON.stringify({
              isDetected: !!newCopyrightInfo.isDetected,
              truncated: true,
              lastChecked: new Date().toISOString(),
              checkCount: minimizedInfo.checkCount,
              message: "Copyright info was too large and has been truncated"
            });
          }
        }
        
        // Update the post with new copyright info
        await prisma.post.update({
          where: { id: post.id },
          data: {
            copyrightInfo: copyrightInfoString,
            updatedAt: new Date(), // Update timestamp
          },
        });
        
        // If copyright is newly detected that wasn't before, create notification
        if (newCopyrightInfo && newCopyrightInfo.isDetected) {
          try {
            // Check if it was detected before
            let wasDetectedBefore = false;
            if (post.copyrightInfo) {
              try {
                const oldInfo = JSON.parse(post.copyrightInfo);
                wasDetectedBefore = oldInfo && oldInfo.isDetected;
              } catch (e) {
                console.error(`[Copyright Service] Error parsing old copyright info:`, e);
              }
            }
            
            // If newly detected, handle the copyright strike
            if (!wasDetectedBefore) {
              console.log(`[Copyright Service] New copyright detected for post ${post.id}, creating strike notification.`);
              await handleCopyrightStrike(post.userId, post.id, newCopyrightInfo);
            }
          } catch (e) {
            console.error(`[Copyright Service] Error handling copyright strike:`, e);
          }
        }
        
        console.log(`[Copyright Service] Successfully rechecked post ${post.id}`);
      } catch (error) {
        console.error(`[Copyright Service] Error rechecking post ${post.id}:`, error);
      }
      
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`[Copyright Service] Completed recheck cycle for ${postsToRecheck.length} posts.`);
  } catch (error) {
    console.error('[Copyright Service] Error in copyright recheck service:', error);
  }
};

// Timer reference to store the interval
let copyrightRecheckTimer: NodeJS.Timeout | null = null;

// Function to start the copyright recheck service
const startCopyrightRecheckService = (intervalMinutes = 5) => {
  // Don't start if already running
  if (copyrightRecheckTimer) {
    console.log('[Copyright Service] Service is already running.');
    return;
  }
  
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`[Copyright Service] Starting copyright recheck service with ${intervalMinutes} minute interval.`);
  
  // Run once immediately
  recheckCopyright().catch(err => console.error('[Copyright Service] Initial check error:', err));
  
  // Then set up regular interval
  copyrightRecheckTimer = setInterval(() => {
    recheckCopyright().catch(err => console.error('[Copyright Service] Scheduled check error:', err));
  }, intervalMs);
  
  // Return the timer so it can be cleared if needed
  return copyrightRecheckTimer;
};

// Function to stop the copyright recheck service
const stopCopyrightRecheckService = () => {
  if (copyrightRecheckTimer) {
    clearInterval(copyrightRecheckTimer);
    copyrightRecheckTimer = null;
    console.log('[Copyright Service] Copyright recheck service stopped.');
    return true;
  }
  console.log('[Copyright Service] No copyright recheck service running.');
  return false;
};

export { registerUser, 
  loginUser, fetchProfile, 
  updateUserProfile, prisma, 
  upgradeToCreator,
  updateCreatorLevel,
  editCreatorProfile,
  createPost,
  createNotification,
  generateResetCode,
  sendPasswordResetEmail,
  requestPasswordReset,
  resetPassword,
  applyForVerification,
  reviewCreatorVerification,
  getPendingVerificationRequests,
  startCopyrightRecheckService,
  stopCopyrightRecheckService
};