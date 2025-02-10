import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
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
// Register a new user
// Register a new user
const registerUser = async (
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  phoneNumber?: string,
  address?: string,
  dateOfBirth?: Date
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
      verified: false, // Mark user as unverified
    },
  });

  
  // Send the verification code via email
  await sendVerificationEmail(email, verificationCode);

  return user;
};
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

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  return token;
};


// Fetch a user's profile
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
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

// Update a user's profile
const updateUserProfile = async (
  userId: number,
  firstName?: string,
  lastName?: string,
  phoneNumber?: string,
  address?: string,
  dateOfBirth?: Date
) => {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      phoneNumber,
      address,
      dateOfBirth,
    },
  });
  return updatedUser;
};

export { registerUser, loginUser, fetchProfile, updateUserProfile, prisma };