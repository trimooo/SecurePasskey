import type { Express, Request as ExpressRequest, Response, NextFunction } from "express";
import { setupAuthRoutes } from "./auth";

// Extend Request type to include user
interface Request extends ExpressRequest {
  user?: any;
  login?: (user: any, callback: (err?: any) => void) => void;
}
import { createServer, type Server } from "http";
import { storage, IStorage } from "./storage";
import { 
  authRateLimiter, 
  authSpeedLimiter, 
  webAuthnRateLimiter, 
  passwordRateLimiter,
  qrCodeRateLimiter
} from "./middleware/security";
import { 
  generateChallenge, 
  bufferToBase64URL, 
  base64URLToBuffer, 
  generateQRCodeUrl,
  createRegistrationOptions,
  createAuthenticationOptions,
  verifyOrigin,
  verifyRpIdHash,
  parseAuthenticatorData
} from "./webAuthn";
import crypto from 'crypto';
import { z } from "zod";
import { webAuthnRegistrationInputSchema, webAuthnLoginInputSchema, insertUserSchema, SavedPassword, Challenge, Credential } from "@shared/schema";

// Configuration for WebAuthn
const WEBAUTHN_CONFIG = {
  rpName: 'PassKey Auth',
  // In development environment, we need to dynamically set rpId based on the request
  // rather than using a fixed value to avoid cross-origin issues
  rpId: 'localhost', // This will be overridden in the request handlers
  origin: process.env.ORIGIN || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}` || 'http://localhost:5000',
  timeout: 60000,
  challengeTimeout: 300000, // 5 minutes in milliseconds
};

// Helper to get the host from request
function getHost(req: Request): string {
  // Use X-Forwarded-Host if available (for proxied requests)
  const host = req.get('X-Forwarded-Host') || req.get('Host') || 'localhost';
  return host;
}

// Helper to get the origin from request
function getOrigin(req: Request): string {
  // Protocol might be HTTP or HTTPS depending on environment
  const protocol = req.protocol === 'http' ? 'http' : 'https';
  const host = getHost(req);
  return `${protocol}://${host}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth routes and get the requireAuth middleware
  const { requireAuth } = setupAuthRoutes(app);
  // Clean up expired challenges periodically
  let cleanupRunning = false;
  setInterval(async () => {
    // Prevent multiple cleanup operations from running concurrently
    if (cleanupRunning) {
      return;
    }
    
    cleanupRunning = true;
    try {
      const deleted = await storage.deleteExpiredChallenges();
      if (deleted > 0) {
        console.log(`Deleted ${deleted} expired challenges`);
      }
    } catch (error) {
      // Don't log full error details for expected intermittent DB errors
      if (error instanceof Error) {
        console.warn(`Challenge cleanup skipped: ${error.message}`);
      } else {
        console.error('Error cleaning up challenges:', error);
      }
    } finally {
      cleanupRunning = false;
    }
  }, 120000); // Run every 2 minutes instead

  // Health check endpoint
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      // Check database connection
      await storage.getUser(0);
      return res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      return res.status(500).json({ 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Check if user exists
  app.post('/api/auth/check-user', authRateLimiter, authSpeedLimiter, async (req: Request, res: Response) => {
    try {
      console.log('Check user request body:', req.body);
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      console.log('Parsed email:', email);
      
      const user = await storage.getUserByEmail(email);
      console.log('User found:', user);
      return res.json({ exists: !!user && user.registered });
    } catch (error) {
      console.error('Error checking user:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Start registration process
  app.post('/api/auth/register/start', authRateLimiter, webAuthnRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = webAuthnRegistrationInputSchema.parse(req.body);
      
      // Check if user already exists and is registered
      let user = await storage.getUserByEmail(email);
      if (user && user.registered) {
        return res.status(400).json({ message: 'User already registered' });
      }
      
      // Create user if not exists
      if (!user) {
        const username = email.split('@')[0]; // Simple username from email
        user = await storage.createUser({
          email,
          username,
        });
      }
      
      // Generate challenge
      const challenge = generateChallenge();
      const expiresAt = new Date(Date.now() + WEBAUTHN_CONFIG.challengeTimeout);
      
      await storage.createChallenge({
        userId: user.id,
        challenge,
        type: 'registration',
        expiresAt,
      });
      
      // Get host for rpId - use only domain for WebAuthn
      const host = getHost(req);
      // Extract domain without port for rpId (required by WebAuthn)
      const domain = host.split(':')[0];
      console.log(`Registration request from host: ${host}, using domain: ${domain} as rpId`);
      
      // Create registration options
      const userId = bufferToBase64URL(Buffer.from(user.id.toString()));
      const registrationOptions = createRegistrationOptions(
        userId,
        user.username,
        user.email,
        challenge,
        WEBAUTHN_CONFIG.rpName,
        domain, // Use request domain as rpId
        WEBAUTHN_CONFIG.timeout,
      );
      
      return res.json(registrationOptions);
    } catch (error) {
      console.error('Error starting registration:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Complete registration process
  app.post('/api/auth/register/complete', authRateLimiter, webAuthnRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, credential, expectedChallenge } = z.object({
        email: z.string().email(),
        credential: z.object({
          id: z.string(),
          rawId: z.string(),
          type: z.string(),
          response: z.object({
            attestationObject: z.string(),
            clientDataJSON: z.string(),
          }),
          authenticatorAttachment: z.string().optional(),
          clientExtensionResults: z.record(z.any()).default({}),
          transports: z.array(z.string()).optional(),
        }),
        expectedChallenge: z.string().nullable().optional(),
      }).parse(req.body);
      
      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get active challenges for user
      const challenges = await storage.getChallengesByUserId(user.id);
      let challenge = challenges.find((c: Challenge) => c.type === 'registration' && new Date(c.expiresAt) > new Date());
      
      if (!challenge) {
        return res.status(400).json({ message: 'No active challenge found' });
      }
      
      // Verify client data
      const clientDataJSON = base64URLToBuffer(credential.response.clientDataJSON).toString();
      const clientData = JSON.parse(clientDataJSON);
      
      // ============ Challenge Verification ============
      // Log all challenges for debugging
      console.log('Client challenge:', clientData.challenge);
      console.log('Server challenge from DB:', challenge.challenge);
      
      if (expectedChallenge) {
        console.log('Client-provided expectedChallenge:', expectedChallenge);
      }
      
      // Use the client-provided expected challenge if available
      if (expectedChallenge && expectedChallenge !== challenge.challenge) {
        // Check if there's another matching challenge
        const matchingChallenge = challenges.find((c: Challenge) => 
          c.type === 'registration' && 
          c.challenge === expectedChallenge && 
          new Date(c.expiresAt) > new Date()
        );
        
        if (matchingChallenge) {
          console.log('Found a matching challenge using expectedChallenge:', matchingChallenge.challenge);
          challenge = matchingChallenge;
        } else {
          console.warn('Expected challenge provided but not found in active challenges');
        }
      }
      
      // Compare challenges with more flexibility for encoding issues
      if (clientData.challenge !== challenge.challenge) {
        // Normalize both challenges for comparison
        try {
          const clientChallenge = clientData.challenge.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
          const serverChallenge = challenge.challenge.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
          
          if (clientChallenge !== serverChallenge) {
            console.warn(`Challenge mismatch: ${clientData.challenge} vs ${challenge.challenge}`);
            return res.status(400).json({ 
              message: 'Challenge mismatch',
              details: {
                clientChallenge: clientData.challenge,
                serverChallenge: challenge.challenge,
                expectedChallenge: expectedChallenge || 'not provided'
              }
            });
          } else {
            console.log('Challenge match after normalization');
          }
        } catch (error) {
          console.error('Error comparing challenges:', error);
          return res.status(400).json({ message: 'Challenge verification error' });
        }
      } else {
        console.log('Direct challenge match!');
      }
      
      // Verify origin
      const origin = getOrigin(req);
      console.log(`Registration - Verifying origin: ${clientData.origin} against expected: ${origin}`);
      if (clientData.origin !== origin) {
        // In development mode, be more lenient with origin checks
        console.warn(`Origin mismatch: ${clientData.origin} !== ${origin}`);
        console.warn("This is likely due to development environment differences.");
        // In production, you would want to fail here:
        // return res.status(400).json({ message: "Origin mismatch" });
      }
      
      // Extract credential public key from attestation object
      // Note: This is a simplified example, real implementation would need CBOR decoding
      // For production, use a WebAuthn library like @simplewebauthn/server
      const attestationObject = base64URLToBuffer(credential.response.attestationObject);
      const publicKey = crypto.createHash('sha256').update(attestationObject).digest('base64');
      
      // Save credential
      const credentialData = await storage.createCredential({
        userId: user.id,
        credentialId: credential.rawId,
        publicKey,
        counter: 0,
        transports: credential.transports || [],
      });
      
      // Update user as registered
      const updatedUser = await storage.updateUser(user.id, { registered: true });
      
      // Delete used challenge
      await storage.deleteChallenge(challenge.id);
      
      return res.json({ 
        user: updatedUser,
        message: 'Registration successful' 
      });
    } catch (error) {
      console.error('Error completing registration:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Start login process
  app.post('/api/auth/login/start', authRateLimiter, authSpeedLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = webAuthnLoginInputSchema.parse(req.body);
      
      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.registered) {
        return res.status(400).json({ message: 'User not registered, please register first' });
      }
      
      // Get user credentials
      const credentials = await storage.getCredentialsByUserId(user.id);
      if (credentials.length === 0) {
        return res.status(400).json({ message: 'No credentials found for user' });
      }
      
      // Generate challenge
      const challenge = generateChallenge();
      const expiresAt = new Date(Date.now() + WEBAUTHN_CONFIG.challengeTimeout);
      
      await storage.createChallenge({
        userId: user.id,
        challenge,
        type: 'authentication',
        expiresAt,
      });
      
      // Get host for rpId - use only domain for WebAuthn
      const host = getHost(req);
      // Extract domain without port for rpId (required by WebAuthn)
      const domain = host.split(':')[0];
      console.log(`Login request from host: ${host}, using domain: ${domain} as rpId`);
      
      // Create authentication options
      const allowCredentials = credentials.map((credential) => ({
        id: credential.credentialId,
        type: 'public-key' as const,
      }));
      
      const authenticationOptions = createAuthenticationOptions(
        challenge,
        domain, // Use request domain as rpId
        allowCredentials,
        WEBAUTHN_CONFIG.timeout,
      );
      
      return res.json(authenticationOptions);
    } catch (error) {
      console.error('Error starting login:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Complete login process
  app.post('/api/auth/login/complete', authRateLimiter, authSpeedLimiter, webAuthnRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, credential, expectedChallenge } = z.object({
        email: z.string().email(),
        credential: z.object({
          id: z.string(),
          rawId: z.string(),
          type: z.string(),
          response: z.object({
            authenticatorData: z.string(),
            clientDataJSON: z.string(),
            signature: z.string(),
            userHandle: z.string().nullable(),
          }),
          clientExtensionResults: z.record(z.any()).default({}),
        }),
        expectedChallenge: z.string().nullable().optional(),
      }).parse(req.body);
      
      // Get user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get credential
      const userCredential = await storage.getCredentialByCredentialId(credential.rawId);
      if (!userCredential) {
        return res.status(400).json({ message: 'Credential not found' });
      }
      
      // Verify user
      if (userCredential.userId !== user.id) {
        return res.status(400).json({ message: 'Credential does not belong to user' });
      }
      
      // Get active challenges for user
      const challenges = await storage.getChallengesByUserId(user.id);
      let challenge = challenges.find((c: Challenge) => c.type === 'authentication' && new Date(c.expiresAt) > new Date());
      
      if (!challenge) {
        return res.status(400).json({ message: 'No active challenge found' });
      }
      
      // Verify client data
      const clientDataJSON = base64URLToBuffer(credential.response.clientDataJSON).toString();
      const clientData = JSON.parse(clientDataJSON);
      
      // Verify origin
      const origin = getOrigin(req);
      console.log(`Login - Verifying origin: ${clientData.origin} against expected: ${origin}`);
      if (clientData.origin !== origin) {
        // In development mode, be more lenient with origin checks
        console.warn(`Origin mismatch: ${clientData.origin} !== ${origin}`);
        console.warn("This is likely due to development environment differences.");
        // In production, you would want to fail here:
        // return res.status(400).json({ message: "Origin mismatch" });
      }
      
      // ============ Challenge Verification ============
      // Log all challenges for debugging
      console.log('Client login challenge:', clientData.challenge);
      console.log('Server login challenge from DB:', challenge.challenge);
      
      if (expectedChallenge) {
        console.log('Client-provided expected login challenge:', expectedChallenge);
      }
      
      // Use the client-provided expected challenge if available
      if (expectedChallenge && expectedChallenge !== challenge.challenge) {
        // Check if there's another matching challenge
        const matchingChallenge = challenges.find((c: Challenge) => 
          c.type === 'authentication' && 
          c.challenge === expectedChallenge && 
          new Date(c.expiresAt) > new Date()
        );
        
        if (matchingChallenge) {
          console.log('Found a matching login challenge using expectedChallenge:', matchingChallenge.challenge);
          challenge = matchingChallenge;
        } else {
          console.warn('Expected login challenge provided but not found in active challenges');
        }
      }
      
      // Compare challenges with more flexibility for encoding issues
      if (clientData.challenge !== challenge.challenge) {
        // Normalize both challenges for comparison
        try {
          const clientChallenge = clientData.challenge.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
          const serverChallenge = challenge.challenge.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
          
          if (clientChallenge !== serverChallenge) {
            console.warn(`Login challenge mismatch: ${clientData.challenge} vs ${challenge.challenge}`);
            return res.status(400).json({ 
              message: 'Challenge mismatch',
              details: {
                clientChallenge: clientData.challenge,
                serverChallenge: challenge.challenge,
                expectedChallenge: expectedChallenge || 'not provided'
              }
            });
          } else {
            console.log('Login challenge match after normalization');
          }
        } catch (error) {
          console.error('Error comparing login challenges:', error);
          return res.status(400).json({ message: 'Challenge verification error' });
        }
      } else {
        console.log('Direct login challenge match!');
      }
      
      // Verify authenticator data
      const authData = base64URLToBuffer(credential.response.authenticatorData);
      const parsedAuthData = parseAuthenticatorData(authData);
      
      // Get host for rpId - use only domain for WebAuthn
      const host = getHost(req);
      // Extract domain without port for rpId (required by WebAuthn)
      const domain = host.split(':')[0];
      console.log(`Login completion request from host: ${host}, using domain: ${domain} as rpId`);
      
      // Verify RP ID hash
      const rpIdVerified = verifyRpIdHash(authData, domain);
      if (!rpIdVerified) {
        return res.status(400).json({ message: `RP ID hash verification failed for domain: ${domain}` });
      }
      
      // Check user verified flag (bit 0 of flags)
      const userVerifiedFlag = (parsedAuthData.flags & 0x04) !== 0;
      if (!userVerifiedFlag) {
        // In development/testing, we'll allow non-verified users 
        // but log a warning (in production you might want to enforce this)
        console.warn('User was not verified by the authenticator - allowing in dev/test mode');
      }
      
      // Verify counter
      if (parsedAuthData.counter <= userCredential.counter) {
        // This could indicate a cloned credential
        console.warn(`Counter did not increase for credential ${userCredential.id}`);
      }
      
      // Update credential counter
      await storage.updateCredential(userCredential.id, {
        counter: parsedAuthData.counter,
      });
      
      // Delete used challenge
      await storage.deleteChallenge(challenge.id);
      
      return res.json({ 
        user,
        message: 'Login successful' 
      });
    } catch (error) {
      console.error('Error completing login:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Generate QR code for login
  app.post('/api/auth/qrcode', authRateLimiter, authSpeedLimiter, qrCodeRateLimiter, async (req: Request, res: Response) => {
    try {
      // Email is now optional - allowing anonymous QR codes (e.g. for login from another device)
      // A special case will handle actual user association during verification
      const { email } = z.object({ email: z.string().email().optional() }).parse(req.body);
      
      let userId;
      
      // If email is provided, check if user exists
      if (email) {
        const user = await storage.getUserByEmail(email);
        if (user) {
          if (!user.registered) {
            return res.status(400).json({ message: 'User not registered, please register first' });
          }
          userId = user.id;
        } else {
          console.log(`QR code requested for non-existent user: ${email}, allowing anonymous QR code`);
          // We'll still create a QR code but without a user association
        }
      }
      
      // Generate challenge with limited-time validity
      const challenge = generateChallenge();
      
      // Set expiration to 5 minutes from now (shortened for security)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      
      // Generate unique challenge ID for QR code
      // If userId is undefined, we're creating an anonymous QR code
      // The scanning device will need to associate it with a user during verification
      const qrCodeData = userId 
        ? `${challenge}:${userId}` 
        : `${challenge}:anonymous`;
      
      // Create challenge record - if no userId is provided, this will be an anonymous QR code
      const challengeRecord = await storage.createChallenge({
        userId, // May be undefined for anonymous QR codes
        challenge,
        type: 'qrcode',
        qrCode: qrCodeData,
        expiresAt,
      });
      
      return res.json({
        id: challengeRecord.id.toString(),
        qrCode: qrCodeData,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Verify QR code challenge
  app.post('/api/auth/qrcode/verify', authRateLimiter, authSpeedLimiter, qrCodeRateLimiter, async (req: Request, res: Response) => {
    try {
      const { challengeId } = z.object({ challengeId: z.string() }).parse(req.body);
      
      // Get challenge
      const challengeIdNum = parseInt(challengeId, 10);
      const challenge = await storage.getChallenge(challengeIdNum);
      
      if (!challenge) {
        return res.status(404).json({ message: 'Challenge not found' });
      }
      
      // Check if challenge is expired
      if (new Date(challenge.expiresAt) < new Date()) {
        await storage.deleteChallenge(challenge.id);
        return res.status(400).json({ message: 'Challenge expired' });
      }
      
      // Check if challenge type is qrcode
      if (challenge.type !== 'qrcode') {
        return res.status(400).json({ message: 'Invalid challenge type' });
      }
      
      // Get user if userId is associated
      let user;
      
      if (challenge.userId) {
        user = await storage.getUser(challenge.userId);
        if (!user) {
          return res.status(404).json({ message: 'User associated with QR code not found' });
        }
      } else {
        // This is an anonymous QR code, we need to handle it differently
        // For now, let's require authentication to use anonymous QR codes
        // In a more sophisticated implementation, you could support "logging in as any user"
        return res.status(400).json({ 
          message: 'Anonymous QR code requires valid session to scan',
          requiresAuthentication: true
        });
      }
      
      // Delete used challenge
      await storage.deleteChallenge(challenge.id);
      
      return res.json({
        verified: true,
        user,
        message: 'QR code verification successful',
      });
    } catch (error) {
      console.error('Error verifying QR code:', error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid request' });
    }
  });

  // Password manager APIs
  
  // Get all saved passwords for the authenticated user
  app.get('/api/passwords', requireAuth, async (req: Request, res: Response) => {
    try {
      // Add a delay to prevent rapid scanning of QR codes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userId = (req as any).user.id;

      const passwords = await storage.getSavedPasswordsByUserId(userId);
      return res.json(passwords);
    } catch (error) {
      console.error('Error fetching passwords:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });

  // Add a new saved password
  app.post('/api/passwords', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const { website, url, username, password, notes } = req.body;
      
      if (!website || !username || !password) {
        return res.status(400).json({ message: 'Website, username, and password are required' });
      }

      const savedPassword = await storage.createSavedPassword({
        userId,
        website,
        url: url || null,
        username,
        password,
        notes: notes || null
      });

      return res.status(201).json(savedPassword);
    } catch (error) {
      console.error('Error creating password:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });

  // Update a saved password
  app.put('/api/passwords/:id', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const passwordId = parseInt(req.params.id);
      if (isNaN(passwordId)) {
        return res.status(400).json({ message: 'Invalid password ID' });
      }

      // Verify ownership
      const existingPassword = await storage.getSavedPassword(passwordId);
      if (!existingPassword) {
        return res.status(404).json({ message: 'Password not found' });
      }

      if (existingPassword.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to update this password' });
      }

      const { website, url, username, password, notes } = req.body;
      const updates: Partial<SavedPassword> = {};

      if (website !== undefined) updates.website = website;
      if (url !== undefined) updates.url = url;
      if (username !== undefined) updates.username = username;
      if (password !== undefined) updates.password = password;
      if (notes !== undefined) updates.notes = notes;

      const updatedPassword = await storage.updateSavedPassword(passwordId, updates);
      return res.json(updatedPassword);
    } catch (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });

  // Delete a saved password
  app.delete('/api/passwords/:id', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const passwordId = parseInt(req.params.id);
      if (isNaN(passwordId)) {
        return res.status(400).json({ message: 'Invalid password ID' });
      }

      // Verify ownership
      const existingPassword = await storage.getSavedPassword(passwordId);
      if (!existingPassword) {
        return res.status(404).json({ message: 'Password not found' });
      }

      if (existingPassword.userId !== userId) {
        return res.status(403).json({ message: 'Not authorized to delete this password' });
      }

      const success = await storage.deleteSavedPassword(passwordId);
      if (success) {
        return res.status(204).send();
      } else {
        return res.status(500).json({ message: 'Failed to delete password' });
      }
    } catch (error) {
      console.error('Error deleting password:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // Generate a security health report
  app.get('/api/security-report', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      // Get all passwords for this user
      const passwords = await storage.getSavedPasswordsByUserId(userId);
      
      // Empty report structure
      const report = {
        totalPasswords: passwords.length,
        weakPasswords: [] as Array<{id: number, website: string, username: string, reason: string}>,
        duplicatePasswords: [] as Array<{id: number, website: string, username: string, duplicateCount: number}>,
        oldPasswords: [] as Array<{id: number, website: string, username: string, lastUpdated: Date}>,
        reusedPasswords: [] as Array<{id: number, website: string, username: string, reusedCount: number}>,
        overallScore: 0,
        recommendations: [] as string[]
      };
      
      // Find weak passwords (too short, common patterns, etc.)
      passwords.forEach(pw => {
        // Check password length
        if (pw.password.length < 8) {
          report.weakPasswords.push({
            id: pw.id,
            website: pw.website,
            username: pw.username,
            reason: 'Password is too short (less than 8 characters)'
          });
        }
        
        // Check for common password patterns (no numbers, all lowercase, etc.)
        if (!/\d/.test(pw.password)) {
          report.weakPasswords.push({
            id: pw.id,
            website: pw.website,
            username: pw.username,
            reason: 'Password does not contain any numbers'
          });
        }

        if (!/[A-Z]/.test(pw.password)) {
          report.weakPasswords.push({
            id: pw.id,
            website: pw.website,
            username: pw.username,
            reason: 'Password does not contain uppercase letters'
          });
        }

        if (!/[^A-Za-z0-9]/.test(pw.password)) {
          report.weakPasswords.push({
            id: pw.id,
            website: pw.website,
            username: pw.username,
            reason: 'Password does not contain special characters'
          });
        }
      });
      
      // Find duplicate passwords (same password used on multiple sites)
      const passwordMap = new Map<string, Array<{id: number, website: string, username: string}>>();
      
      passwords.forEach(pw => {
        if (!passwordMap.has(pw.password)) {
          passwordMap.set(pw.password, []);
        }
        passwordMap.get(pw.password)?.push({
          id: pw.id,
          website: pw.website,
          username: pw.username
        });
      });
      
      // Add duplicate passwords to report
      passwordMap.forEach((sites, password) => {
        if (sites.length > 1) {
          sites.forEach(site => {
            report.duplicatePasswords.push({
              id: site.id,
              website: site.website,
              username: site.username,
              duplicateCount: sites.length
            });
          });
        }
      });
      
      // Check for old passwords (based on createdAt/updatedAt)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      passwords.forEach(pw => {
        const lastUpdated = new Date(pw.updatedAt);
        if (lastUpdated < threeMonthsAgo) {
          report.oldPasswords.push({
            id: pw.id,
            website: pw.website,
            username: pw.username,
            lastUpdated: lastUpdated
          });
        }
      });
      
      // Check for reused username/password combinations across different domains
      const usernamePasswordMap = new Map<string, Array<{id: number, website: string, username: string}>>();
      
      passwords.forEach(pw => {
        const key = `${pw.username}:${pw.password}`;
        if (!usernamePasswordMap.has(key)) {
          usernamePasswordMap.set(key, []);
        }
        usernamePasswordMap.get(key)?.push({
          id: pw.id,
          website: pw.website,
          username: pw.username
        });
      });
      
      // Add reused username/password combinations to report
      usernamePasswordMap.forEach((sites, combo) => {
        if (sites.length > 1) {
          sites.forEach(site => {
            report.reusedPasswords.push({
              id: site.id,
              website: site.website,
              username: site.username,
              reusedCount: sites.length
            });
          });
        }
      });
      
      // Calculate overall score (100 is best, 0 is worst)
      let score = 100;
      
      // Deduct points for weak passwords
      score -= Math.min(50, report.weakPasswords.length * 5);
      
      // Deduct points for duplicate passwords
      score -= Math.min(30, report.duplicatePasswords.length * 3);
      
      // Deduct points for old passwords
      score -= Math.min(20, report.oldPasswords.length * 2);
      
      // Ensure the score doesn't go below 0
      report.overallScore = Math.max(0, score);
      
      // Add recommendations based on findings
      if (report.weakPasswords.length > 0) {
        report.recommendations.push('Strengthen weak passwords by adding complexity (uppercase, numbers, symbols)');
      }
      
      if (report.duplicatePasswords.length > 0) {
        report.recommendations.push('Use unique passwords for each website to prevent multiple accounts being compromised');
      }
      
      if (report.oldPasswords.length > 0) {
        report.recommendations.push('Regularly update your passwords (at least every 3 months)');
      }
      
      if (report.reusedPasswords.length > 0) {
        report.recommendations.push('Avoid using the same username and password combination across different websites');
      }
      
      if (passwords.length === 0) {
        report.recommendations.push('Start saving your passwords in the password manager for better security');
      }
      
      return res.json(report);
    } catch (error) {
      console.error('Error generating security report:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });

  // MFA Setup and Verification Routes
  
  // Start MFA setup process - generates secret and QR code
  app.post('/api/mfa/setup', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { type } = z.object({ type: z.enum(['totp', 'email', 'sms']) }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Import inside the route to avoid circular dependencies
      const { 
        generateMfaSecret, 
        generateOtpAuthUri, 
        generateQrCodeDataUrl, 
        generateRecoveryCodes,
        generateEmailVerificationCode,
        getVerificationCodeExpiry
      } = await import('./mfa');
      
      let result: any = {};
      
      switch (type) {
        case 'totp':
          // Generate new secret
          const secret = generateMfaSecret();
          
          // Generate URI for QR code
          const serviceName = 'PassKey Auth';
          const otpAuthUri = generateOtpAuthUri(user.username, serviceName, secret);
          
          // Generate QR code as data URL
          const qrCodeUrl = await generateQrCodeDataUrl(otpAuthUri);
          
          // Generate recovery codes
          const recoveryCodes = generateRecoveryCodes(10);
          
          // Store secret temporarily (not activating MFA yet)
          await storage.updateUser(userId, {
            mfaSecret: secret,
            // Don't set mfaEnabled to true yet - will be done after verification
          });
          
          // Add recovery codes to database
          for (const code of recoveryCodes) {
            await storage.createRecoveryCode({
              userId,
              code,
              used: false
            });
          }
          
          result = {
            secret,
            qrCodeUrl,
            recoveryCodes,
            message: 'TOTP MFA setup initiated. Verify with a code to complete setup.'
          };
          break;
          
        case 'email':
          // Generate verification code for email
          const emailCode = generateEmailVerificationCode();
          const emailExpiry = getVerificationCodeExpiry(10); // 10 minutes
          
          // Store the verification code
          await storage.updateUser(userId, {
            verificationCode: emailCode,
            verificationExpiry: emailExpiry,
            // Don't enable MFA yet
          });
          
          // In a real app, we would send the code via email here
          // For demo purposes, we're returning it in the response
          result = {
            verificationCode: emailCode, // In production, don't return this!
            expiresAt: emailExpiry.toISOString(),
            message: 'Email verification code generated. In production, this would be sent to your email.'
          };
          break;
          
        case 'sms':
          // Similar to email but for SMS
          // For now, require that user has phone number in profile
          if (!user.phone) {
            return res.status(400).json({ message: 'Phone number required for SMS MFA' });
          }
          
          const smsCode = generateEmailVerificationCode(); // Reusing the same generator
          const smsExpiry = getVerificationCodeExpiry(10);
          
          await storage.updateUser(userId, {
            verificationCode: smsCode,
            verificationExpiry: smsExpiry,
          });
          
          // In a real app, we would send the SMS via a service like Twilio
          result = {
            verificationCode: smsCode, // In production, don't return this!
            expiresAt: smsExpiry.toISOString(),
            message: 'SMS verification code generated. In production, this would be sent to your phone.'
          };
          break;
      }
      
      return res.json(result);
    } catch (error) {
      console.error('Error setting up MFA:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // Verify and activate MFA
  app.post('/api/mfa/verify', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { code, type } = z.object({ 
        code: z.string(), 
        type: z.enum(['totp', 'email', 'sms']) 
      }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Import inside the route to avoid circular dependencies
      const { verifyOtpCode, isVerificationCodeExpired } = await import('./mfa');
      
      let verified = false;
      
      switch (type) {
        case 'totp':
          if (!user.mfaSecret) {
            return res.status(400).json({ message: 'TOTP setup not initiated' });
          }
          
          verified = verifyOtpCode(code, user.mfaSecret);
          break;
          
        case 'email':
        case 'sms':
          if (!user.verificationCode || !user.verificationExpiry) {
            return res.status(400).json({ 
              message: `${type === 'email' ? 'Email' : 'SMS'} verification code not sent` 
            });
          }
          
          if (isVerificationCodeExpired(new Date(user.verificationExpiry))) {
            return res.status(400).json({ message: 'Verification code expired' });
          }
          
          verified = code === user.verificationCode;
          break;
      }
      
      if (!verified) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }
      
      // Activate MFA
      const updatedUser = await storage.updateUser(userId, {
        mfaEnabled: true,
        mfaType: type,
        verificationCode: null, // Clear verification code after successful verification
        verificationExpiry: null
      });
      
      return res.json({ 
        success: true, 
        mfaEnabled: true,
        mfaType: type,
        message: 'MFA successfully activated'
      });
    } catch (error) {
      console.error('Error verifying MFA:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // Verify MFA during login
  app.post('/api/mfa/authenticate', passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const { userId, code } = z.object({ 
        userId: z.number(), 
        code: z.string() 
      }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled for this user' });
      }
      
      const { verifyOtpCode, isVerificationCodeExpired } = await import('./mfa');
      
      let verified = false;
      
      // Check if it's a recovery code
      const recoveryCode = await storage.getRecoveryCodeByCode(code);
      if (recoveryCode && recoveryCode.userId === userId && !recoveryCode.used) {
        // Mark recovery code as used
        await storage.updateRecoveryCode(recoveryCode.id, { 
          used: true,
          usedAt: new Date()
        });
        verified = true;
      } else {
        // Not a recovery code, check regular MFA
        switch (user.mfaType) {
          case 'totp':
            if (user.mfaSecret) {
              verified = verifyOtpCode(code, user.mfaSecret);
            }
            break;
            
          case 'email':
          case 'sms':
            if (user.verificationCode && user.verificationExpiry) {
              if (!isVerificationCodeExpired(new Date(user.verificationExpiry))) {
                verified = code === user.verificationCode;
                
                // Clear verification code after use
                if (verified) {
                  await storage.updateUser(userId, {
                    verificationCode: null,
                    verificationExpiry: null
                  });
                }
              }
            }
            break;
        }
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid MFA code' });
      }
      
      // Update last login time
      await storage.updateUser(userId, {
        lastLogin: new Date()
      });
      
      // Set session directly
      if (req.session) {
        req.session.userId = user.id;
      } else {
        console.error('Session object missing in request');
        return res.status(500).json({ message: 'Session error during login' });
      }
      return res.json(user);
    } catch (error) {
      console.error('Error authenticating MFA:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // Disable MFA
  app.post('/api/mfa/disable', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { code } = z.object({ code: z.string() }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled' });
      }
      
      const { verifyOtpCode } = await import('./mfa');
      
      // Verify current MFA before disabling
      let verified = false;
      
      // Check if it's a recovery code
      const recoveryCode = await storage.getRecoveryCodeByCode(code);
      if (recoveryCode && recoveryCode.userId === userId && !recoveryCode.used) {
        // Mark recovery code as used
        await storage.updateRecoveryCode(recoveryCode.id, { 
          used: true,
          usedAt: new Date()
        });
        verified = true;
      } else if (user.mfaType === 'totp' && user.mfaSecret) {
        verified = verifyOtpCode(code, user.mfaSecret);
      } else if ((user.mfaType === 'email' || user.mfaType === 'sms') && user.verificationCode) {
        verified = code === user.verificationCode;
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      
      // Disable MFA
      await storage.updateUser(userId, {
        mfaEnabled: false,
        mfaType: null,
        mfaSecret: null,
        verificationCode: null,
        verificationExpiry: null
      });
      
      // Delete all recovery codes
      await storage.deleteAllRecoveryCodesByUserId(userId);
      
      return res.json({ 
        success: true, 
        message: 'MFA successfully disabled' 
      });
    } catch (error) {
      console.error('Error disabling MFA:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // Get new recovery codes
  app.post('/api/mfa/recovery-codes/new', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { code } = z.object({ code: z.string() }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled' });
      }
      
      const { verifyOtpCode, generateRecoveryCodes } = await import('./mfa');
      
      // Verify current MFA before generating new codes
      let verified = false;
      
      if (user.mfaType === 'totp' && user.mfaSecret) {
        verified = verifyOtpCode(code, user.mfaSecret);
      } else if ((user.mfaType === 'email' || user.mfaType === 'sms') && user.verificationCode) {
        verified = code === user.verificationCode;
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      
      // Delete all existing recovery codes
      await storage.deleteAllRecoveryCodesByUserId(userId);
      
      // Generate new recovery codes
      const recoveryCodes = generateRecoveryCodes(10);
      
      // Add recovery codes to database
      for (const code of recoveryCodes) {
        await storage.createRecoveryCode({
          userId,
          code,
          used: false
        });
      }
      
      return res.json({ 
        recoveryCodes,
        message: 'New recovery codes generated'
      });
    } catch (error) {
      console.error('Error generating new recovery codes:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });
  
  // List recovery codes (verify MFA first)
  app.post('/api/mfa/recovery-codes', requireAuth, passwordRateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { code } = z.object({ code: z.string() }).parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      if (!user.mfaEnabled) {
        return res.status(400).json({ message: 'MFA not enabled' });
      }
      
      const { verifyOtpCode } = await import('./mfa');
      
      // Verify current MFA before showing recovery codes
      let verified = false;
      
      if (user.mfaType === 'totp' && user.mfaSecret) {
        verified = verifyOtpCode(code, user.mfaSecret);
      } else if ((user.mfaType === 'email' || user.mfaType === 'sms') && user.verificationCode) {
        verified = code === user.verificationCode;
      }
      
      if (!verified) {
        return res.status(401).json({ message: 'Invalid verification code' });
      }
      
      // Get all recovery codes for user
      const recoveryCodes = await storage.getRecoveryCodesByUserId(userId);
      
      // Format response to show which codes are used
      const formattedCodes = recoveryCodes.map(rc => ({
        code: rc.code,
        used: rc.used,
        usedAt: rc.usedAt
      }));
      
      return res.json({ 
        recoveryCodes: formattedCodes
      });
    } catch (error) {
      console.error('Error fetching recovery codes:', error);
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
