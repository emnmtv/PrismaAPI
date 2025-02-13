import { Response } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import { 
  registerUser, 
  loginUser, 
  fetchProfile, 
  updateUserProfile, 
  prisma,
  upgradeToCreator,
  editCreatorProfile
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
    // Get the token and user role after login
    const token = await loginUser(email, password);

    // Get the user object to retrieve the role
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found');
    }

    // Send the token and role in the response
    res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role, // Add the role to the response
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
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
export { 
  handleRegister, 
  handleLogin, 
  handleGetProfile, 
  handleUpdateProfile, 
  handleEmailVerification,
  handleUpgradeToCreator,
  handleGetCreatorProfile,
  handleEditCreatorProfile
};
