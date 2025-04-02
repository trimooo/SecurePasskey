import { Request, Response, NextFunction } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { storage } from './storage';
import { z } from 'zod';
import { User, InsertUser } from '@shared/schema';
import { Express } from 'express';
import session from 'express-session';
import * as mfaUtils from './mfa';

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
  // MFA functions are imported at the top
  // Setup session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'local-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    store: storage.getSessionStore()
  }));
  
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
      
      // Check if user has MFA enabled
      if (user.mfaEnabled) {
        // If user has MFA enabled, don't log them in yet
        // Instead, return information that MFA is required
        // The client will need to make a request to /api/mfa/authenticate
        
        // For email or SMS MFA types, we need to send a verification code
        if (user.mfaType === 'email' || user.mfaType === 'sms') {
          try {
            // Import MFA utilities
            const { generateEmailVerificationCode, getVerificationCodeExpiry } = await import('./mfa');
            
            // Generate verification code
            const verificationCode = generateEmailVerificationCode();
            const expiresAt = getVerificationCodeExpiry(10); // 10 minutes
            
            // Store verification code
            await storage.updateUser(user.id, {
              verificationCode,
              verificationExpiry: expiresAt
            });
            
            // In production, we would send this code via email or SMS
            // For demo purposes, we'll include it in the response
            return res.status(200).json({
              requiresMfa: true,
              mfaType: user.mfaType,
              userId: user.id,
              // In production, don't return this - send via email/SMS only
              verificationCode,
              expiresAt: expiresAt.toISOString(),
              message: `MFA required. Verification code has been sent to your ${user.mfaType}.`
            });
          } catch (error) {
            console.error('Error generating MFA verification code:', error);
            return res.status(500).json({ message: 'Error generating MFA verification code' });
          }
        } else {
          // For TOTP, no verification code is sent - the user has it in their authenticator app
          return res.status(200).json({
            requiresMfa: true,
            mfaType: user.mfaType,
            userId: user.id,
            message: 'MFA required. Please enter the code from your authenticator app.'
          });
        }
      }
      
      // If no MFA, proceed with normal login
      // Set session
      req.session!.userId = user.id;
      
      // Update last login time
      await storage.updateUser(user.id, {
        lastLogin: new Date()
      });
      
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
  
  // MFA verification endpoint
  app.post('/api/mfa/verify', async (req: Request, res: Response) => {
    try {
      const { userId, code, mfaType } = z.object({
        userId: z.number(),
        code: z.string(),
        mfaType: z.enum(['email', 'sms', 'totp', 'recovery'])
      }).parse(req.body);
      
      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify MFA is enabled
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled for this user' });
      }
      
      let verified = false;
      
      if (mfaType === 'recovery') {
        // Handle recovery code
        const recoveryCode = await storage.getRecoveryCodeByCode(code);
        
        if (!recoveryCode || recoveryCode.userId !== user.id || recoveryCode.used) {
          return res.status(401).json({ message: 'Invalid recovery code' });
        }
        
        // Mark recovery code as used
        await storage.updateRecoveryCode(recoveryCode.id, {
          used: true,
          usedAt: new Date()
        });
        
        verified = true;
      } else if (mfaType === 'totp' && user.mfaType === 'totp') {
        // Verify TOTP code
        if (!user.mfaSecret) {
          return res.status(401).json({ message: 'TOTP not set up properly' });
        }
        
        verified = mfaUtils.verifyOtpCode(code, user.mfaSecret);
      } else if ((mfaType === 'email' || mfaType === 'sms') && 
                 (user.mfaType === 'email' || user.mfaType === 'sms')) {
        // Verify email/SMS verification code
        if (!user.verificationCode || !user.verificationExpiry) {
          return res.status(401).json({ message: 'No verification code found or code expired' });
        }
        
        // Check if code is expired
        if (mfaUtils.isVerificationCodeExpired(user.verificationExpiry)) {
          return res.status(401).json({ message: 'Verification code expired' });
        }
        
        // Compare code
        verified = user.verificationCode === code;
        
        // Clear verification code after use
        if (verified) {
          await storage.updateUser(user.id, {
            verificationCode: null,
            verificationExpiry: null
          });
        }
      } else {
        return res.status(400).json({ message: 'Invalid MFA type' });
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      
      // Set session
      req.session!.userId = user.id;
      
      // Update last login
      await storage.updateUser(user.id, {
        lastLogin: new Date()
      });
      
      return res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('MFA verification error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // MFA setup endpoint
  app.post('/api/mfa/setup', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type } = z.object({
        type: z.enum(['totp', 'email', 'sms'])
      }).parse(req.body);
      
      const user = req.user!;
      
      // Setup based on type
      if (type === 'totp') {
        // Generate TOTP secret
        const secret = mfaUtils.generateMfaSecret();
        
        // Generate QR code for TOTP setup
        const otpAuthUrl = mfaUtils.generateOtpAuthUri(
          user.username || user.email,
          'PassKey Auth',
          secret
        );
        
        const qrCodeDataUrl = await mfaUtils.generateQrCodeDataUrl(otpAuthUrl);
        
        // Generate recovery codes
        const recoveryCodes = mfaUtils.generateRecoveryCodes();
        
        // Save recovery codes
        for (const code of recoveryCodes) {
          await storage.createRecoveryCode({
            userId: user.id,
            code,
            used: false
          });
        }
        
        // Return setup data (actual saving of MFA settings will happen after verification)
        return res.json({
          secret,
          qrCode: qrCodeDataUrl,
          recoveryCodes,
          otpAuthUrl
        });
      } else if (type === 'email') {
        // Email MFA setup
        if (!user.email) {
          return res.status(400).json({ message: 'User has no email address' });
        }
        
        // Generate verification code
        const verificationCode = mfaUtils.generateEmailVerificationCode();
        const expiresAt = mfaUtils.getVerificationCodeExpiry(10); // 10 minutes
        
        // Store verification code
        await storage.updateUser(user.id, {
          verificationCode,
          verificationExpiry: expiresAt
        });
        
        // Generate recovery codes
        const recoveryCodes = mfaUtils.generateRecoveryCodes();
        
        // Save recovery codes
        for (const code of recoveryCodes) {
          await storage.createRecoveryCode({
            userId: user.id,
            code,
            used: false
          });
        }
        
        // In production, send code via email
        // For demo, return it directly
        return res.json({
          verificationCode,
          expiresAt: expiresAt.toISOString(),
          recoveryCodes
        });
      } else if (type === 'sms') {
        // SMS MFA setup
        if (!user.phone) {
          return res.status(400).json({ message: 'User has no phone number' });
        }
        
        // Generate verification code
        const verificationCode = mfaUtils.generateEmailVerificationCode();
        const expiresAt = mfaUtils.getVerificationCodeExpiry(10); // 10 minutes
        
        // Store verification code
        await storage.updateUser(user.id, {
          verificationCode,
          verificationExpiry: expiresAt
        });
        
        // Generate recovery codes
        const recoveryCodes = mfaUtils.generateRecoveryCodes();
        
        // Save recovery codes
        for (const code of recoveryCodes) {
          await storage.createRecoveryCode({
            userId: user.id,
            code,
            used: false
          });
        }
        
        // In production, send code via SMS
        // For demo, return it directly
        return res.json({
          verificationCode,
          expiresAt: expiresAt.toISOString(),
          recoveryCodes
        });
      }
      
      return res.status(400).json({ message: 'Invalid MFA type' });
    } catch (error) {
      console.error('MFA setup error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Endpoint to enable MFA after verification
  app.post('/api/mfa/enable', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type, code, secret } = z.object({
        type: z.enum(['totp', 'email', 'sms']),
        code: z.string(),
        secret: z.string().optional()
      }).parse(req.body);
      
      const user = req.user!;
      let verified = false;
      
      if (type === 'totp') {
        // Verify TOTP code
        if (!secret) {
          return res.status(400).json({ message: 'Secret is required for TOTP setup' });
        }
        
        verified = mfaUtils.verifyOtpCode(code, secret);
        
        if (verified) {
          // Save TOTP settings
          await storage.updateUser(user.id, {
            mfaEnabled: true,
            mfaType: 'totp',
            mfaSecret: secret
          });
        }
      } else if (type === 'email' || type === 'sms') {
        // Verify email/SMS code
        if (!user.verificationCode || !user.verificationExpiry) {
          return res.status(401).json({ message: 'No verification code found or code expired' });
        }
        
        // Check if code is expired
        if (mfaUtils.isVerificationCodeExpired(user.verificationExpiry)) {
          return res.status(401).json({ message: 'Verification code expired' });
        }
        
        // Compare code
        verified = user.verificationCode === code;
        
        if (verified) {
          // Save MFA settings
          await storage.updateUser(user.id, {
            mfaEnabled: true,
            mfaType: type,
            verificationCode: null,
            verificationExpiry: null
          });
        }
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      
      const updatedUser = await storage.getUser(user.id);
      return res.json({
        success: true,
        user: updatedUser
      });
    } catch (error) {
      console.error('MFA enable error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Endpoint to disable MFA
  app.post('/api/mfa/disable', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = z.object({
        password: z.string()
      }).parse(req.body);
      
      const user = req.user!;
      
      // Verify password
      if (!user.password) {
        return res.status(400).json({ message: 'Cannot disable MFA: no password set' });
      }
      
      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      
      // Disable MFA
      await storage.updateUser(user.id, {
        mfaEnabled: false,
        mfaType: null,
        mfaSecret: null
      });
      
      // Delete all recovery codes
      await storage.deleteAllRecoveryCodesByUserId(user.id);
      
      const updatedUser = await storage.getUser(user.id);
      return res.json({
        success: true,
        user: updatedUser
      });
    } catch (error) {
      console.error('MFA disable error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Endpoint to get recovery codes
  app.get('/api/mfa/recovery-codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled' });
      }
      
      const recoveryCodes = await storage.getRecoveryCodesByUserId(user.id);
      
      return res.json({
        recoveryCodes: recoveryCodes.filter(code => !code.used).map(code => code.code)
      });
    } catch (error) {
      console.error('MFA recovery codes error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });
  
  // Endpoint to generate new recovery codes
  app.post('/api/mfa/recovery-codes/new', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { password } = z.object({
        password: z.string()
      }).parse(req.body);
      
      const user = req.user!;
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled' });
      }
      
      // Verify password
      if (!user.password) {
        return res.status(400).json({ message: 'Cannot generate new recovery codes: no password set' });
      }
      
      const isValidPassword = await comparePasswords(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid password' });
      }
      
      // Delete existing recovery codes
      await storage.deleteAllRecoveryCodesByUserId(user.id);
      
      // Generate new recovery codes
      const recoveryCodes = mfaUtils.generateRecoveryCodes();
      
      // Save new recovery codes
      for (const code of recoveryCodes) {
        await storage.createRecoveryCode({
          userId: user.id,
          code,
          used: false
        });
      }
      
      return res.json({
        recoveryCodes
      });
    } catch (error) {
      console.error('MFA generate recovery codes error:', error);
      return res.status(400).json({ 
        message: error instanceof Error ? error.message : 'Invalid request' 
      });
    }
  });

  return { requireAuth };
}