import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your_jwt_secret'; // Replace with your actual secret

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
    // Optionally, if you have extended the Request type to include a 'user' property:
    (req as any).user = user; // Or, if you have declared a proper type augmentation, simply: req.user = user;
    next(); // Proceed to the next middleware or route handler
  });
};

export { authenticateToken };
