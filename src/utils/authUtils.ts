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
  detailedDescription?: string,
  amount?: string, // Accept amount as string from the frontend
  remarks?: string,
  image?: string,
  video?: string
) => {
  try {
    // Check if the user has already created a post
    const existingPost = await prisma.post.findFirst({
      where: { userId },
    });

    if (existingPost) {
      throw new Error('User already has a post. Only one post is allowed.');
    }

    // Convert amount to Float
    const amountAsFloat = amount ? parseFloat(amount) : null;

    // Create the new post if no existing post found
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
  detailedDescription?: string, // New field
  amount?: number, // New field
  remarks?: string, // New field
  image?: string, // Base64 encoded image
  video?: string // Base64 encoded video
) => {
  try {
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        description,
        detailedDescription, // Include detailed description
        amount, // Include amount
        remarks, // Include remarks
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

    // Calculate and update creator's average rating
    const averageRating = await prisma.rating.aggregate({
      where: {
        userId: userId
      },
      _avg: {
        rating: true
      }
    });

    return {
      rating: ratingRecord,
      averageRating: averageRating._avg.rating
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

export { registerUser, 
  loginUser, fetchProfile, 
  updateUserProfile, prisma, 
  upgradeToCreator,
  editCreatorProfile,
  createPost,


};