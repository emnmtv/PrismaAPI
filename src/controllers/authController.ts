import { Response,Request, } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import jwt from 'jsonwebtoken';
import { 
  registerUser, 
  loginUser, 
  fetchProfile, 
  updateUserProfile, 
  prisma,
  upgradeToCreator,
  editCreatorProfile,
  createPost,
  updatePost,
  deletePost,
  createPaymentLink,
  fetchPaymentsForUser,
  updateOrderStatus,
  fetchPaymentsForClient,
  updateOrderStatusForClient,
  rateCreator,
  getCreatorRatings,
  getCreatorRatingsByCreatorId,
  updatePostStatus,
  deletePostAdmin,
  fetchAllUsers,
  trackProfileView,
  trackPostView,
  trackAudioPlay,
  trackClickThrough,
  getCreatorAnalytics,
  requestPasswordReset,
  resetPassword
} from '../utils/authUtils';
import { checkPaymentStatus } from '../utils/authUtils';
import { JWT_SECRET } from '../middleware/authMiddleware';

// Handle User Registration
const handleRegister = async (req: AuthRequest, res: Response) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    address,
    dateOfBirth,
    role, // Accept the role from request
  } = req.body;

  // Validate required fields
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: 'Email, password, first name, and last name are required' });
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength validation
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    const user = await registerUser(
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth ? new Date(dateOfBirth) : undefined,
      role // Pass role while registering
    );
    res.status(201).json({ 
      message: 'User registered successfully. Please verify your email.', 
      user,
      resent: user.verificationCode !== null // Indicate if this is a resend
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    
    // Check if the error is about email already in use
    if (errorMessage.includes('Email already in use')) {
      res.status(409).json({ error: errorMessage }); // 409 Conflict
    } else {
      res.status(400).json({ error: errorMessage });
    }
  }
};

// Handle Email Verification
const handleEmailVerification = async (req: AuthRequest, res: Response) => {
  const { email, code } = req.body;

  // Validate required fields
  if (!email || !code) {
     res.status(400).json({ error: 'Email and verification code are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.verificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Check if verification code is expired (older than 10 minutes)
    if (user.createdAt) {
      const codeAge = new Date().getTime() - user.createdAt.getTime();
      const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
      
      if (codeAge > tenMinutes) {
        // Delete the user record as the code is expired
        await prisma.user.delete({ where: { email } });
        throw new Error('Verification code expired. Please register again to receive a new code.');
      }
    }

    await prisma.user.update({
      where: { email },
      data: {
        verified: true,
        verificationCode: null,
      },
    });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle User Login
const handleLogin = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    // First check if user exists and is unverified
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && !user.verified) {
      await prisma.user.delete({
        where: { email }
      });
      
      throw new Error('Your account was not verified and has been deleted. Please register again.');
    }

    // Proceed with normal login if user is verified
    const token = await loginUser(email, password);

    // Get the user object again (in case it was updated)
    const verifiedUser = await prisma.user.findUnique({ where: { email } });

    if (!verifiedUser) {
      throw new Error('User not found');
    }

    res.status(200).json({
      message: 'Login successful',
      token,
      role: verifiedUser.role
    });
  } catch (error) {
    res.status(400).json({ 
      error: (error as Error).message,
      isDeleted: (error as Error).message.includes('deleted')
    });
  }
};


// Handle Fetching User Profile
const handleGetProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  try {
    const userProfile = await fetchProfile(userId);
    res.status(200).json({
      message: 'Profile fetched successfully',
      userProfile: {
        ...userProfile,
        profilePicture: userProfile.profilePicture ? `/uploads/${userProfile.profilePicture}` : null,
        coverPhoto: userProfile.coverPhoto ? `/uploads/${userProfile.coverPhoto}` : null,
      }
    });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
};

// Handle Updating User Profile
const handleUpdateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth
    } = req.body;

    // Handle file uploads
    const profilePicture = files?.profilePicture?.[0]?.filename;
    const coverPhoto = files?.coverPhoto?.[0]?.filename;

    const updatedUser = await updateUserProfile(
      userId,
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth ? new Date(dateOfBirth) : undefined,
      profilePicture || undefined,  // Only update if new file uploaded
      coverPhoto || undefined       // Only update if new file uploaded
    );

    res.status(200).json({
      message: 'Profile updated successfully',
      user: {
        ...updatedUser,
        profilePicture: updatedUser.profilePicture ? `/uploads/${updatedUser.profilePicture}` : null,
        coverPhoto: updatedUser.coverPhoto ? `/uploads/${updatedUser.coverPhoto}` : null,
      }
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
const handleUpgradeToCreator = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { 
    offers, 
    bio, 
    profession, 
    typeOfProfession, 
    genre,
    socialLinks 
  } = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const portfolioFile = files?.portfolioFile?.[0]?.filename;
  const resumeFile = files?.resumeFile?.[0]?.filename;

  try {
    if (!offers) {
      throw new Error('Offers field is required');
    }

    // Parse social links from string if it exists
    let parsedSocialLinks;
    if (socialLinks) {
      try {
        parsedSocialLinks = JSON.parse(socialLinks);
      } catch (e) {
        throw new Error('Invalid social links format');
      }

      // Validate social links array
      if (!Array.isArray(parsedSocialLinks)) {
        throw new Error('Social links must be an array');
      }

      if (parsedSocialLinks.length > 5) {
        throw new Error('Maximum 5 social media links allowed');
      }

      // Validate each social link
      parsedSocialLinks.forEach((link: any) => {
        if (!link.platform || !link.url) {
          throw new Error('Each social link must have a platform and URL');
        }
        if (!isValidUrl(link.url)) {
          throw new Error(`Invalid URL for platform: ${link.platform}`);
        }
      });
    }

    // Upgrade the user to a creator and create the creator profile
    const upgradedUser = await upgradeToCreator(
      userId,
      offers,
      bio,
      profession,
      typeOfProfession,
      genre,
      portfolioFile || undefined,
      resumeFile || undefined,
      parsedSocialLinks
    );

    res.status(200).json({
      message: 'User upgraded to Creator successfully',
      upgradedUser,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Helper function to validate URLs
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const handleGetCreatorProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  try {
    // Fetch the user's creator profile and user data
    const creatorProfileWithUser = await prisma.creatorProfile.findUnique({
      where: { userId },
      include: {
        user: true,  // This will include the associated User model in the result
        socialLinks: true,
        
      },
    });

    if (!creatorProfileWithUser) {
      res.status(404).json({ error: 'Creator profile not found' });
      return; // Ensure the function exits here if profile is not found
    }

    res.status(200).json({
      message: 'Creator profile fetched successfully',
      creatorProfile: creatorProfileWithUser,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Function to handle editing the Creator Profile
const handleEditCreatorProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { offers, bio, profession, typeOfProfession, genre, socialLinks } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  try {
    // Validate at least one field to be updated
    if (!offers && !bio && !profession && !typeOfProfession && !genre && !files && !socialLinks) {
      throw new Error('At least one field must be provided to edit the profile');
    }

    // Get file names if files were uploaded
    const portfolioFile = files?.portfolioFile?.[0]?.filename;
    const resumeFile = files?.resumeFile?.[0]?.filename;

    // Parse social links if provided
    let parsedSocialLinks;
    if (socialLinks) {
      try {
        parsedSocialLinks = JSON.parse(socialLinks);
        if (!Array.isArray(parsedSocialLinks)) {
          throw new Error('Social links must be an array');
        }
        if (parsedSocialLinks.length > 5) {
          throw new Error('Maximum 5 social media links allowed');
        }
        // Validate each social link
        parsedSocialLinks.forEach((link: any) => {
          if (!link.platform || !link.url) {
            throw new Error('Each social link must have a platform and URL');
          }
          if (!isValidUrl(link.url)) {
            throw new Error(`Invalid URL for platform: ${link.platform}`);
          }
        });
      } catch (e) {
        throw new Error('Invalid social links format');
      }
    }

    // Edit the creator profile
    const editedProfile = await editCreatorProfile(
      userId,
      offers,
      bio,
      profession,
      typeOfProfession,
      genre,
      portfolioFile || undefined,
      resumeFile || undefined,
      parsedSocialLinks
    );

    if (!editedProfile) {
      throw new Error('Failed to update creator profile');
    }

    // Add full URLs for files in the response
    const responseProfile = {
      ...editedProfile,
      portfolioFile: editedProfile.portfolioFile ? `/uploads/documents/${editedProfile.portfolioFile}` : null,
      resumeFile: editedProfile.resumeFile ? `/uploads/documents/${editedProfile.resumeFile}` : null,
    };

    res.status(200).json({
      message: 'Creator Profile updated successfully',
      profile: responseProfile,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};



const handleCreatePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(403).json({ error: 'User ID not found in token' });
      return;
    }

    const { title, description, detailedDescription, amount, remarks } = req.body;

    // Log the request body to debug undefined values
    console.log('Post creation request body:', req.body);

    // Validate title and description
    if (!title || title === 'undefined') {
      res.status(400).json({ error: 'Title is required and cannot be undefined' });
      return;
    }

    if (!description || description === 'undefined') {
      res.status(400).json({ error: 'Description is required and cannot be undefined' });
      return;
    }

    // Get files if present
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const image = files?.image?.[0]?.filename;
    const video = files?.video?.[0]?.filename;
    const audio = files?.audio?.[0]?.filename;

    // Validate audio file size if provided - ensure it's not too large
    if (audio) {
      const fs = require('fs');
      const audioFilePath = `uploads/audio/${audio}`;
      
      try {
        const stats = fs.statSync(audioFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 20) {
          res.status(400).json({
            error: 'Audio file too large',
            message: 'Audio files must be under 20MB for copyright detection. Please compress your file or upload a smaller one.'
          });
          return;
        }
      } catch (err) {
        console.error('Error checking audio file size:', err);
        // Continue even if we can't check size, the post creation will still work
      }
    }

    const newPost = await createPost(
      userId,
      title,
      description,
      detailedDescription,
      amount,
      remarks,
      image,
      video,
      audio
    );

    // Log the new post for debugging
    console.log('New post created:', newPost);

    res.status(201).json({
      message: 'Post created successfully',
      post: newPost, // Return as 'post' field to match frontend's expectation
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Failed to create post' });
    }
  }
};

export const handleEditPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(403).json({ error: 'User ID not found in token' });
      return;
    }

    const { postId, title, description, detailedDescription, amount, remarks } = req.body;

    if (!postId || !title || !description) {
      res.status(400).json({ error: 'Post ID, title, and description are required' });
      return;
    }

    // Get files if present
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const image = files?.image?.[0]?.filename;
    const video = files?.video?.[0]?.filename;
    const audio = files?.audio?.[0]?.filename;

    // Check if the post exists and if the user is the owner
    const post = await prisma.post.findUnique({ 
      where: { id: parseInt(postId) } 
    });

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({ error: 'You can only edit your own posts' });
      return;
    }

    // Validate audio file size if provided - ensure it's not too large
    if (audio) {
      const fs = require('fs');
      const audioFilePath = `uploads/audio/${audio}`;
      
      try {
        const stats = fs.statSync(audioFilePath);
        const fileSizeInMB = stats.size / (1024 * 1024);
        
        if (fileSizeInMB > 20) {
          res.status(400).json({
            error: 'Audio file too large',
            message: 'Audio files must be under 20MB for copyright detection. Please compress your file or upload a smaller one.'
          });
          return;
        }
      } catch (err) {
        console.error('Error checking audio file size:', err);
        // Continue even if we can't check size, the post update will still work
      }
    }

    // Parse amount to number if it's a string
    let parsedAmount = amount;
    if (typeof amount === 'string' && amount.trim() !== '') {
      parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        res.status(400).json({ error: 'Amount must be a valid number' });
        return;
      }
    }

    // Call the function to update the post
    const updatedPost = await updatePost(
      parseInt(postId),
      title,
      description,
      detailedDescription,
      parsedAmount,
      remarks,
      image,
      video,
      audio // Add audio to the update
    );

    res.status(200).json({
      message: 'Post updated successfully',
      data: updatedPost,
    });
  } catch (error) {
    console.error('Error updating post:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: 'Failed to update post' });
    }
  }
};
export const handleGetUserWithProfileAndPosts = async (
  req: AuthRequest, // Use AuthRequest type to access user from token
  res: Response
): Promise<void> => {
  try {
    console.log("Received request at /viewpost");
    console.log("Headers:", req.headers); // Debugging to see the headers for the token

    const userId = req.user?.userId; // Extract userId from the token payload

    if (!userId) {
      console.log("User not authenticated");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        creatorProfile: true,
        posts: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Remove URL construction for image and video
    const userWithMedia = {
      ...user,
      posts: user.posts.map(post => ({
        ...post,
        // image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
        // video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
      })),
    };

    res.status(200).json(userWithMedia);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const handleGetUserWithProfileAndPosts2 = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Received request at /viewpost");
    console.log("Query Params:", req.query); // Debugging

    const userId = req.query.userId as string; // Extract userId from query params

    if (!userId) {
      console.log("Missing userId parameter");
      res.status(400).json({ message: "Missing userId parameter" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      include: {
        creatorProfile: true,
        posts: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Remove URL construction for image and video
    const userWithMedia = {
      ...user,
      posts: user.posts.map(post => ({
        ...post,
        // image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
        // video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
      })),
    };

    res.status(200).json(userWithMedia);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const handleGetPostWithUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Received request at /viewpostwithuser");
    console.log("Query Params:", req.query); // Debugging

    const postId = req.query.postId as string; // Extract postId from query params

    if (!postId) {
      console.log("Missing postId parameter");
      res.status(400).json({ message: "Missing postId parameter" });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: Number(postId) },
      include: {
        user: {
          include: {
            creatorProfile: {
              include: {
                socialLinks: true // Include social links
              }
            },
          },
        },
      },
    });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // Format profile pictures
    const postWithUserDetails = {
      ...post,
      user: {
        ...post.user,
        profilePicture: post.user.profilePicture ? `/uploads/${post.user.profilePicture}` : null,
        coverPhoto: post.user.coverPhoto ? `/uploads/${post.user.coverPhoto}` : null,
        creatorProfile: post.user.creatorProfile ? {
          ...post.user.creatorProfile,
          portfolioFile: post.user.creatorProfile.portfolioFile ? `/uploads/documents/${post.user.creatorProfile.portfolioFile}` : null,
          resumeFile: post.user.creatorProfile.resumeFile ? `/uploads/documents/${post.user.creatorProfile.resumeFile}` : null,
        } : null,
      },
    };

    res.status(200).json(postWithUserDetails);
  } catch (error) {
    console.error("Error fetching post with user data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const handleGetAllPostsWithUserDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Received request at /viewallpostswithuser");
    console.log("Query Params:", req.query); // Debugging

    // Fetch all posts with user details
    const posts = await prisma.post.findMany({
      include: {
        user: {
          include: {
            creatorProfile: {
              include: {
                socialLinks: true
              }
            },
          },
        },
      },
    });

    if (!posts || posts.length === 0) {
      res.status(404).json({ message: "No posts found" });
      return;
    }

    // Format profile pictures and documents
    const postsWithUserDetails = posts.map((post) => ({
      ...post,
      user: {
        ...post.user,
        profilePicture: post.user.profilePicture ? `/uploads/${post.user.profilePicture}` : null,
        coverPhoto: post.user.coverPhoto ? `/uploads/${post.user.coverPhoto}` : null,
        creatorProfile: post.user.creatorProfile ? {
          ...post.user.creatorProfile,
          portfolioFile: post.user.creatorProfile.portfolioFile ? `/uploads/documents/${post.user.creatorProfile.portfolioFile}` : null,
          resumeFile: post.user.creatorProfile.resumeFile ? `/uploads/documents/${post.user.creatorProfile.resumeFile}` : null,
        } : null,
      },
    }));

    res.status(200).json(postsWithUserDetails);
  } catch (error) {
    console.error("Error fetching posts with user data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



// authController.ts
export const handleDeletePost = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Assuming user is authenticated
  const { postId } = req.body;

  try {
    if (!postId) {
      throw new Error('Post ID is required');
    }

    // Check if the post exists and if the user is the owner
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('You can only delete your own posts');
    }

    // Call the function to delete the post
    await deletePost(postId);

    res.status(200).json({
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Controller function to initiate payment
export const handleInitiatePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, description, remarks } = req.body; // Remove clientId from here
  const clientId = req.body.clientId; // Get clientId from the request body (the user you are sending payment to)
  const userId = req.user!.userId; // Get the userId of the authenticated user

  if (!amount || !description || !remarks || !clientId) { // Check for required fields
    res.status(400).json({ error: 'Missing required fields' });
    return; // Ensure the function exits after sending the response
  }

  try {
    // Create the payment link using the utility function
    const paymentLink = await createPaymentLink(amount, description, remarks, clientId); // Pass clientId

    // Save payment details in the database
    await prisma.payment.create({
      data: {
        userId: userId, // Set userId to the authenticated user's ID
        clientId: clientId, // Add clientId to the payment data (the recipient)
        referenceNumber: paymentLink.referenceNumber,
        checkoutUrl: paymentLink.checkoutUrl,
        amount: amount, // Store amount in the smallest unit (e.g., cents)
        description: description,
        remarks: remarks,
        status: paymentLink.status,
      },
    });

    // Send response with payment link data
    res.status(200).json({
      message: 'Payment link created successfully.',
      paymentUrl: paymentLink.checkoutUrl,
      referenceNumber: paymentLink.referenceNumber,
      status: paymentLink.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
};

// Function to create a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Function to log the current time every minute
const startClock = () => {
  const interval = setInterval(() => {
    const now = new Date();
    console.log(`Current Time: ${now.toLocaleTimeString()}`);
  }, 60000); // Log every minute

  return interval; // Return the interval ID to clear it later
};

// Function to check payment status
export const handleCheckPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { referenceNumber } = req.query; // Get reference number from query parameters

  // Ensure referenceNumber is a string
  if (typeof referenceNumber !== 'string') {
    res.status(400).json({ error: 'Reference number is required and must be a string' });
    return; // Ensure the function exits after sending the response
  }

  const clockInterval = startClock(); // Start the clock

  try {
    const payment = await prisma.payment.findUnique({
      where: { referenceNumber: referenceNumber },
    });

    if (!payment) {
      clearInterval(clockInterval); // Clear the clock if payment not found
      res.status(404).json({ error: 'Payment not found' });
      return; // Ensure the function exits after sending the response
    }

    // Introduce a delay of 5 minutes (300,000 milliseconds)
    await delay(300000); // 5 minutes delay

    // Clear the clock after the delay
    clearInterval(clockInterval);

    // Here you can call the PayMongo API to check the status
    const paymentStatus = await checkPaymentStatus(referenceNumber); // Call the function to check payment status

    // Update the payment status in the database
    await prisma.payment.update({
      where: { referenceNumber: referenceNumber },
      data: { status: paymentStatus }, // Update the status field
    });

    res.status(200).json({ status: paymentStatus });
  } catch (error) {
    clearInterval(clockInterval); // Clear the clock on error
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
};

// Handle fetching payments for the authenticated user
const handleFetchPayments = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Get the authenticated user's ID

  try {
    const payments = await fetchPaymentsForUser(userId);
    res.status(200).json({ message: 'Payments fetched successfully', payments });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

// Handle updating the order status of a payment
const handleUpdateOrderStatus = async (req: AuthRequest, res: Response) => {
  const { referenceNumber, newStatus } = req.body; // Get reference number and new status from request body

  try {
    const updatedPayment = await updateOrderStatus(referenceNumber, newStatus);
    res.status(200).json({ message: 'Order status updated successfully', updatedPayment });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle fetching payments for a client
const handleFetchPaymentsForClient = async (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId; // Assuming the clientId is the authenticated user's ID

  try {
    const payments = await fetchPaymentsForClient(clientId);
    res.status(200).json({ message: 'Payments fetched successfully', payments });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

// Handle updating the order status of a payment from the client side
const handleUpdateOrderStatusForClient = async (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId; // Get the authenticated user's ID
  const { referenceNumber, newStatus } = req.body; // Get reference number and new status from request body

  try {
    const updatedPayment = await updateOrderStatusForClient(clientId, referenceNumber, newStatus);
    res.status(200).json({ message: 'Order status updated successfully', updatedPayment });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const handleSubmitRating = async (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { userId, paymentId, rating, review } = req.body;

  try {
    const result = await rateCreator(
      clientId,
      userId,
      paymentId,
      rating,
      review
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const handleGetCreatorRatings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId; // Get userId from token
    const ratings = await getCreatorRatings(userId);
    res.status(200).json(ratings);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle post approval/rejection
export const handleUpdatePostStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user!.userId;
    const { postId, status } = req.body;

    if (!postId || !status) {
      res.status(400).json({ error: 'Post ID and status are required' });
      return;
    }

    if (!['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be "approved" or "rejected"' });
      return;
    }

    const updatedPost = await updatePostStatus(Number(postId), status, adminId);
    res.status(200).json({ 
      message: `Post ${status} successfully`,
      post: updatedPost 
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle post deletion by admin
export const handleDeletePostAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminId = req.user!.userId;
    const { postId } = req.body;

    if (!postId) {
      res.status(400).json({ error: 'Post ID is required' });
      return;
    }

    await deletePostAdmin(Number(postId), adminId);
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Add this handler for admin posts
export const handleGetAdminPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Fetch all posts including rejected ones
    const posts = await prisma.post.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle fetching all users (admin only)
export const handleGetAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    const users = await fetchAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Get users under copyright review (admin only)
const handleGetUsersUnderReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Find users under copyright review
    const usersUnderReview = await prisma.user.findMany({
      where: {
        underReview: true
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        copyrightStrikes: true,
        underReview: true,
        createdAt: true,
        updatedAt: true,
        creatorProfile: {
          select: {
            id: true,
            profession: true,
            bio: true,
          }
        },
        posts: {
          select: {
            id: true,
            title: true,
            audio: true,
            copyrightInfo: true,
            createdAt: true,
          },
          where: {
            audio: { not: null },
            copyrightInfo: { not: null }
          },
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        },
        _count: {
          select: {
            posts: true
          }
        }
      }
    });

    res.status(200).json(usersUnderReview);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Get users with active restrictions (admin only)
const handleGetUsersWithRestrictions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Verify admin role
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!admin || admin.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only admins can access this endpoint' });
      return;
    }

    // Find users with active restrictions
    const usersWithRestrictions = await prisma.user.findMany({
      where: {
        restrictionType: { not: null }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        copyrightStrikes: true,
        restrictionType: true,
        restrictionExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        creatorProfile: {
          select: {
            id: true,
            profession: true,
            bio: true,
          }
        }
      }
    });

    res.status(200).json(usersWithRestrictions);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Add this controller function
export const handleGoogleLogin = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  try {
    // Verify the Google token
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
    const userData = await response.json();

    if (!userData.email) {
      throw new Error('Failed to get user email from Google');
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    // If user doesn't exist, create one
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.given_name,
          lastName: userData.family_name,
          password: '', // Empty password for Google users
          verified: true, // Google users are already verified
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Add this new controller function
export const handleGetCreatorRatingsByCreatorId = async (req: AuthRequest, res: Response) => {
  try {
    const creatorId = parseInt(req.params.creatorId);
    
    if (isNaN(creatorId)) {
     res.status(400).json({ error: 'Invalid creator ID' });
    }
    
    const ratings = await getCreatorRatingsByCreatorId(creatorId);
    res.status(200).json(ratings);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle tracking profile view
export const handleTrackProfileView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const creatorId = parseInt(req.params.creatorId);
    const viewerId = req.user?.userId; // May be undefined for anonymous views
    
    if (isNaN(creatorId)) {
      res.status(400).json({ error: 'Invalid creator ID' });
      return;
    }
    
    const engagement = await trackProfileView(creatorId, viewerId);
    res.status(200).json({ success: true, engagement });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle tracking post view
export const handleTrackPostView = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = parseInt(req.params.postId);
    const viewerId = req.user?.userId; // May be undefined for anonymous views
    
    if (isNaN(postId)) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    
    const engagement = await trackPostView(postId, viewerId);
    res.status(200).json({ success: true, engagement });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle tracking audio play
export const handleTrackAudioPlay = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = parseInt(req.params.postId);
    const viewerId = req.user?.userId; // May be undefined for anonymous views
    const duration = req.body.duration ? parseInt(req.body.duration) : undefined;
    
    if (isNaN(postId)) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    
    const engagement = await trackAudioPlay(postId, viewerId, duration);
    res.status(200).json({ success: true, engagement });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle tracking click-through
export const handleTrackClickThrough = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sourceType, sourceId, destinationType } = req.body;
    const viewerId = req.user?.userId; // May be undefined for anonymous views
    
    if (!sourceType || !sourceId || !destinationType) {
      res.status(400).json({ error: 'sourceType, sourceId, and destinationType are required' });
      return;
    }
    
    if (sourceType !== 'post' && sourceType !== 'profile') {
      res.status(400).json({ error: 'sourceType must be either "post" or "profile"' });
      return;
    }
    
    const parsedSourceId = parseInt(sourceId);
    if (isNaN(parsedSourceId)) {
      res.status(400).json({ error: 'Invalid source ID' });
      return;
    }
    
    const engagement = await trackClickThrough(
      sourceType as 'post' | 'profile',
      parsedSourceId,
      destinationType,
      viewerId
    );
    
    res.status(200).json({ success: true, engagement });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle getting creator analytics
export const handleGetCreatorAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const creatorId = req.params.creatorId 
      ? parseInt(req.params.creatorId)
      : req.user!.userId; // Default to authenticated user if no ID provided
    
    const { startDate, endDate } = req.query;
    
    if (isNaN(creatorId)) {
      res.status(400).json({ error: 'Invalid creator ID' });
      return;
    }
    
    const analytics = await getCreatorAnalytics(
      creatorId,
      startDate as string | undefined,
      endDate as string | undefined
    );
    
    res.status(200).json(analytics);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle forgot password request
const handleForgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  // Validate required fields
  if (!email) {
     res.status(400).json({ error: 'Email is required' });
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
   res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    await requestPasswordReset(email);
    res.status(200).json({ 
      message: 'If an account exists with this email, a password reset code has been sent.' 
    });
  } catch (error) {
    // Send success message even if email doesn't exist for security reasons
    // This prevents email enumeration attacks
    res.status(200).json({ 
      message: 'If an account exists with this email, a password reset code has been sent.' 
    });
    
    // But log the actual error for debugging
    console.error('Password reset error:', (error as Error).message);
  }
};

// Handle reset password with code
const handleResetPassword = async (req: Request, res: Response) => {
  const { email, resetCode, newPassword } = req.body;

  // Validate required fields
  if (!email || !resetCode || !newPassword) {
    res.status(400).json({ error: 'Email, reset code, and new password are required' });
  }

  // Validate new password
  if (newPassword.length < 6) {
     res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const result = await resetPassword(email, resetCode, newPassword);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export { 
  handleRegister, 
  handleLogin, 
  handleGetProfile, 
  handleUpdateProfile, 
  handleEmailVerification,
  handleUpgradeToCreator,
  handleGetCreatorProfile,
  handleEditCreatorProfile,
  handleCreatePost,
  handleFetchPayments,
  handleUpdateOrderStatus,
  handleFetchPaymentsForClient,
  handleUpdateOrderStatusForClient,
  handleGetUsersUnderReview,
  handleGetUsersWithRestrictions,
  handleForgotPassword,
  handleResetPassword
};
