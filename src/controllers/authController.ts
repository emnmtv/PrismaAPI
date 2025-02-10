import { Response } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import { registerUser, loginUser, fetchProfile, updateUserProfile,prisma } from '../utils/authUtils';

// Register a new user
// Register a new user
const register = async (req: AuthRequest, res: Response) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    address,
    dateOfBirth,
  } = req.body;

  try {
    const user = await registerUser(
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth ? new Date(dateOfBirth) : undefined
    );
    res.status(201).json({ message: 'User registered successfully. Please verify your email.', user });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
// Verify Email
const verifyEmail = async (req: AuthRequest, res: Response) => {
  const { email, code } = req.body;

  try {
    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if the verification code matches
    if (user.verificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    // Update the user's verified status
    await prisma.user.update({
      where: { email },
      data: {
        verified: true,
        verificationCode: null, // Clear the verification code after success
      },
    });

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Login a user
const login = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    const token = await loginUser(email, password);
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

// Fetch a user's profile
const getProfile = async (req: AuthRequest, res: Response) => {
  // Now TypeScript recognizes req.user
  const userId = req.user!.userId;
  try {
    const userProfile = await fetchProfile(userId);
    res.status(200).json({ message: 'Profile fetched successfully', userProfile });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
};

// Update a user's profile
const updateProfile = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId; // Get userId from the token
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

export { register, login, getProfile, updateProfile,verifyEmail};
