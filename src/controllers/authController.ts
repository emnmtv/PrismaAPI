import { Response } from 'express';
import { AuthRequest } from '@/middleware/authRequest';
import { 
  registerUser, 
  loginUser, 
  fetchProfile, 
  updateUserProfile, 
  prisma 
} from '../utils/authUtils';

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
    const token = await loginUser(email, password);
    res.status(200).json({ message: 'Login successful', token });
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

export { 
  handleRegister, 
  handleLogin, 
  handleGetProfile, 
  handleUpdateProfile, 
  handleEmailVerification 
};
