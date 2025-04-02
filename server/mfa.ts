import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Configure authenticator
authenticator.options = {
  window: 1, // Allow one token backward/forward for time sync issues
  step: 30   // Default time step in seconds (30 is standard)
};

// Generate a new MFA secret
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

// Generate recovery codes for MFA
export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate a 10-character alphanumeric code with dashes for readability
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(code.slice(0, 5) + '-' + code.slice(5, 10));
  }
  return codes;
}

// Verify OTP code against secret
export function verifyOtpCode(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch (error) {
    console.error('Error verifying OTP code:', error);
    return false;
  }
}

// Generate a TOTP URI for QR codes
export function generateOtpAuthUri(username: string, serviceName: string, secret: string): string {
  return authenticator.keyuri(username, serviceName, secret);
}

// Generate a QR code as data URI
export async function generateQrCodeDataUrl(otpAuthUri: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpAuthUri);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

// Helper to generate a verification code for email MFA
export function generateEmailVerificationCode(): string {
  // Generate a 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to check if a verification code has expired
export function isVerificationCodeExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

// Calculate verification code expiry date (e.g., 10 minutes from now)
export function getVerificationCodeExpiry(minutes: number = 10): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
}