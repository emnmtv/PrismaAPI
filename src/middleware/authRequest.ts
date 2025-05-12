import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role?: string; // Add role property for admin checks
    email?: string; // Add email for additional user info
    // Add additional properties here if needed
  };
}
