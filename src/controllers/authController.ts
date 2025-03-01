import { Response,Request, } from 'express';
import { AuthRequest } from '@/middleware/authRequest';

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
  updatePostStatus,
  deletePostAdmin,
  fetchAllUsers,
} from '../utils/authUtils';
import { checkPaymentStatus } from '../utils/authUtils';
// Handle User Registration
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
    res.status(201).json({ message: 'User registered successfully. Please verify your email.', user });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Handle Email Verification
const handleEmailVerification = async (req: AuthRequest, res: Response) => {
  const { email, code } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.verificationCode !== code) {
      throw new Error('Invalid verification code');
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
    res.status(200).json({ message: 'Profile fetched successfully', userProfile });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
};

// Handle Updating User Profile
const handleUpdateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { firstName, lastName, phoneNumber, address, dateOfBirth } = req.body;

  try {
    const updatedUser = await updateUserProfile(
      userId,
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth ? new Date(dateOfBirth) : undefined
    );
    res.status(200).json({ message: 'Profile updated successfully', updatedUser });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
const handleUpgradeToCreator = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { offers, bio, profession, typeOfProfession, genre } = req.body;

  try {
    if (!offers) {
      throw new Error('Offers field is required');
    }

    // Upgrade the user to a creator and create the creator profile
    const upgradedUser = await upgradeToCreator(
      userId,
      offers,
      bio,
      profession,
      typeOfProfession,
      genre
    );

    res.status(200).json({
      message: 'User upgraded to Creator successfully',
      upgradedUser,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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
  const { offers, bio, profession, typeOfProfession, genre } = req.body;

  try {
    // Validate at least one field to be updated
    if (!offers && !bio && !profession && !typeOfProfession && !genre) {
      throw new Error('At least one field must be provided to edit the profile');
    }

    // Edit the creator profile
    const editedProfile = await editCreatorProfile(
      userId,
      offers,  // Now 'offers' must be provided
      bio,
      profession,
      typeOfProfession,
      genre
    );

    res.status(200).json({
      message: 'Creator Profile updated successfully',
      editedProfile,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};



const handleCreatePost = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Assuming user is authenticated
  const { title, description, detailedDescription, amount, remarks } = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const image = files?.image?.[0]?.filename;
  const video = files?.video?.[0]?.filename;

  try {
    if (!title || !description) {
      throw new Error('Title and description are required');
    }

    // Call the function to create the post
    const post = await createPost(
      userId,
      title,
      description,
      detailedDescription,
      amount,
      remarks,
      image,
      video
    );

    res.status(200).json({
      message: 'Post created successfully',
      post,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const handleEditPost = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Assuming user is authenticated
  const { postId, title, description, detailedDescription, amount, remarks } = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const image = files?.image?.[0]?.filename;
  const video = files?.video?.[0]?.filename;

  try {
    if (!postId || !title || !description) {
      throw new Error('Post ID, title, and description are required');
    }

    // Check if the post exists and if the user is the owner
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new Error('Post not found');
    }

    if (post.userId !== userId) {
      throw new Error('You can only edit your own posts');
    }

    // Call the function to update the post
    const updatedPost = await updatePost(
      postId,
      title,
      description,
      detailedDescription,
      amount,
      remarks,
      image,
      video
    );

    res.status(200).json({
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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
            creatorProfile: true,
          },
        },
      },
    });

    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // Remove URL construction for image and video
    const postWithUserDetails = {
      ...post,
      user: {
        ...post.user,
        creatorProfile: post.user.creatorProfile ? {
          ...post.user.creatorProfile,
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
            creatorProfile: true,
          },
        },
      },
    });

    if (!posts || posts.length === 0) {
      res.status(404).json({ message: "No posts found" });
      return;
    }

    // Remove URL construction for image and video
    const postsWithUserDetails = posts.map((post) => ({
      ...post,
      user: {
        ...post.user,
        creatorProfile: post.user.creatorProfile ? {
          ...post.user.creatorProfile,
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

};
