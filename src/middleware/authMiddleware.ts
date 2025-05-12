import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './authRequest';

export const JWT_SECRET = 'your_jwt_secret';

const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expected format: "Bearer <token>"

  if (!token) {
    // Send the error response without returning a value
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return; // Exit the middleware
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Send the error response without returning a value
      res.status(403).json({ error: 'Invalid or expired token.' });
      return; // Exit the callback
    }
    
    // Use the AuthRequest interface to type the request
    (req as AuthRequest).user = {
      userId: (user as any).userId,
      role: (user as any).role, // Include role from the token
      email: (user as any).email // Include email from the token
    };
    
    next(); // Proceed to the next middleware or route handler
  });
};

export { authenticateToken };
