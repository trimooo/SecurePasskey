import { Request, Response, NextFunction } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { storage } from './storage';
import { z } from 'zod';
import { User, InsertUser } from '@shared/schema';
import { Express } from 'express';
import session from 'express-session';

// For type safety with express session
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

// Extend the Express Request type
interface AuthenticatedRequest extends Request {
  user?: User;
}

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

// Hash a password with scrypt
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

// Compare a password against a stored hash
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Set up authentication routes and middleware
export function setupAuthRoutes(app: Express) {
  // Register a new user
  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const { username, password, email } = z.object({
        username: z.string().min(3),
        password: z.string().min(8),
        email: z.string().email(),
      }).parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        registered: true,
      });
      
      // Set session
      req.session!.userId = user.id;
      
      return res.status(201).json(user);
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Login user
  app.post('/api/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = z.object({
        username: z.string(),
        password: z.string(),
      }).parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Check if user has a password (in case they're using passkeys exclusively)
      if (!user.password) {
        return res.status(401).json({ message: 'This account requires passkey authentication' });
      }
      
      // Verify password
      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Set session
      req.session!.userId = user.id;
      
      return res.json(user);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Logout user
  app.post('/api/logout', (req: Request, res: Response) => {
    // Clear the session
    req.session!.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ message: 'Error logging out' });
      }
      
      res.clearCookie('connect.sid');
      return res.json({ message: 'Logged out successfully' });
    });
  });
  
  // Get current user
  app.get('/api/user', async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        // Clear invalid session
        req.session!.userId = undefined;
        return res.status(401).json({ message: 'User not found' });
      }
      
      return res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Server error' 
      });
    }
  });
  
  // Middleware to check if user is authenticated
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        // Clear invalid session
        req.session!.userId = undefined;
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Attach user to request for use in route handlers
      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Server error' 
      });
    }
  };
  
  return { requireAuth };
}