import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Common rate limiter configuration options
const rateLimitConfig = {
  standardHeaders: 'draft-7', // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
};

// Basic rate limiter for all routes
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  ...rateLimitConfig,
});

// Stricter rate limiter for sensitive routes (login, register, etc.)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // limit each IP to 10 login/register attempts per 15 minutes
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes' },
  ...rateLimitConfig,
});

// Speed limiter for auth routes - slows down responses after too many requests
export const authSpeedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // allow 5 requests per 15 minutes, then...
  delayMs: (hits) => hits * 200, // add 200ms * number of hits over threshold
});

// Rate limiter specifically for password-related operations
export const passwordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30, // limit each IP to 30 password operations per hour
  message: { error: 'Too many password operations, please try again after an hour' },
  ...rateLimitConfig,
});

// Extra protection for WebAuthn operations
export const webAuthnRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // limit each IP to 20 WebAuthn operations per 15 minutes
  message: { error: 'Too many WebAuthn operations, please try again after 15 minutes' },
  ...rateLimitConfig,
});

// Rate limiter for QR code operations
export const qrCodeRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 15, // limit each IP to 15 QR code operations per 10 minutes
  message: { error: 'Too many QR code operations, please try again after 10 minutes' },
  ...rateLimitConfig,
});

// Helper middleware to log rate limit hits
export const logRateLimitHit = (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore - rateLimit property is added by express-rate-limit
  const requestCount = req.rateLimit?.current;
  // @ts-ignore
  const requestMax = req.rateLimit?.limit;
  
  if (requestCount && requestMax && requestCount > requestMax * 0.8) {
    console.warn(`Rate limit approaching for IP ${req.ip}: ${requestCount}/${requestMax}`);
  }
  
  next();
};

// Detect and block suspicious requests
export const detectSuspiciousRequests = (req: Request, res: Response, next: NextFunction) => {
  // Check for missing or suspicious headers
  if (!req.headers['user-agent'] || req.headers['user-agent'].length < 10) {
    return res.status(403).send('Forbidden: Invalid request signature');
  }
  
  // Check for rapid consecutive requests from the same IP (potential bot behavior)
  // This would require tracking request timestamps per IP in a real implementation
  
  next();
};