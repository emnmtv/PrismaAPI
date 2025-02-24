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
  


} from '../utils/authUtils';


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

    // Convert file paths to full URLs
    const userWithMedia = {
      ...user,
      posts: user.posts.map(post => ({
        ...post,
        image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
        video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
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

    // Convert file paths to full URLs
    const userWithMedia = {
      ...user,
      posts: user.posts.map(post => ({
        ...post,
        image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
        video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
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

    // Convert file paths to full URLs
    const postWithUserDetails = {
      ...post,
      image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
      video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
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

    // Map through all posts and convert file paths to full URLs
    const postsWithUserDetails = posts.map((post) => ({
      ...post,
      image: post.image ? `http://localhost:3200/uploads/${post.image}` : null,
      video: post.video ? `http://localhost:3200/uploads/${post.video}` : null,
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
export const handleInitiatePayment = async (req: Request, res: Response): Promise<void> => {
  const { amount, description, remarks } = req.body;

  if (!amount || !description || !remarks) {
    res.status(400).json({ error: 'Missing required fields' });
    return; // Ensure the function exits after sending the response
  }

  try {
    // Create the payment link using the utility function
    const paymentLink = await createPaymentLink(amount, description, remarks);

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

};
