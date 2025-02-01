import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    // Add additional properties here if needed
  };
}
