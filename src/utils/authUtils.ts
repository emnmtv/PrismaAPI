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
      role: true,    // Include the role
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


const upgradeToCreator = async (
  userId: number,
  offers: string,
  bio?: string,
  profession?: string,
  typeOfProfession?: string,
  genre?: string
) => {
  // Update user role
  const updatedUser = await prisma.user.update({
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
    },
  });

  return { ...updatedUser, creatorProfile };
};

// Function to edit the Creator Profile
const editCreatorProfile = async (
  userId: number,
  offers?: string,
  bio?: string,
  profession?: string,
  typeOfProfession?: string,
  genre?: string
) => {
  // Ensure 'offers' is a valid string, if not, throw an error
  if (!offers) {
    throw new Error('The offers field is required');
  }

  // Update Creator Profile if it exists, otherwise create it
  const updatedProfile = await prisma.creatorProfile.upsert({
    where: { userId },
    update: {
      offers,
      bio: bio || undefined,
      profession: profession || undefined,
      typeOfProfession: typeOfProfession || undefined,
      genre: genre || undefined,
    },
    create: {
      userId,
      offers,
      bio,
      profession,
      typeOfProfession,
      genre,
    },
  });

  return updatedProfile;
};

const createPost = async (
  userId: number,
  title: string,
  description: string,
  image?: string, // Base64 encoded image
  video?: string // Base64 encoded video
) => {
  try {
    // Check if the user has already created a post
    const existingPost = await prisma.post.findFirst({
      where: { userId },
    });

    if (existingPost) {
      throw new Error('User already has a post. Only one post is allowed.');
    }

    // Create the new post if no existing post found
    const newPost = await prisma.post.create({
      data: {
        userId,
        title,
        description,
        image, // Image is saved as base64 string
        video, // Video is saved as base64 string
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


// authUtils.ts
export const updatePost = async (
  postId: number,
  title: string,
  description: string,
  image?: string, // Base64 encoded image
  video?: string // Base64 encoded video
) => {
  try {
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        description,
        image, // Image is saved as base64 string
        video, // Video is saved as base64 string
      },
    });

    return updatedPost;
  } catch (error) {
    throw new Error('Failed to update post');
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



export { registerUser, 
  loginUser, fetchProfile, 
  updateUserProfile, prisma, 
  upgradeToCreator,
  editCreatorProfile,
  createPost,


};