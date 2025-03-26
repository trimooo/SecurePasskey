import crypto from 'crypto';

// Base64URL encoding and decoding
export function base64URLToBuffer(base64url: string): Buffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  return Buffer.from(padded, 'base64');
}

export function bufferToBase64URL(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate a cryptographically secure random challenge
export function generateChallenge(): string {
  return bufferToBase64URL(crypto.randomBytes(32));
}

// Generate a QR code URL for authentication
export function generateQRCodeUrl(challengeId: string, origin: string): string {
  return `${origin}/api/auth/qrcode/verify?id=${challengeId}`;
}

// Verify the origin of the client data
export function verifyOrigin(clientDataJSON: string, expectedOrigin: string): boolean {
  try {
    const clientData = JSON.parse(Buffer.from(base64URLToBuffer(clientDataJSON)).toString());
    return clientData.origin === expectedOrigin;
  } catch (error) {
    console.error('Error verifying origin:', error);
    return false;
  }
}

// Parse authenticator data
export function parseAuthenticatorData(authData: Buffer): {
  rpIdHash: Buffer;
  flags: number;
  counter: number;
} {
  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const counterBuffer = authData.slice(33, 37);
  const counter = counterBuffer.readUInt32BE(0);

  return {
    rpIdHash,
    flags,
    counter,
  };
}

// Verify the RP ID hash in the authenticator data
export function verifyRpIdHash(authData: Buffer, rpId: string): boolean {
  const rpIdHash = crypto.createHash('sha256').update(rpId).digest();
  const dataRpIdHash = authData.slice(0, 32);
  return rpIdHash.equals(dataRpIdHash);
}

// Create options for WebAuthn registration
export function createRegistrationOptions(
  userId: string,
  username: string,
  email: string,
  challenge: string,
  rpName: string,
  rpId: string,
  timeout: number = 60000,
) {
  return {
    challenge,
    rp: {
      name: rpName,
      id: rpId,
    },
    user: {
      id: userId,
      name: email,
      displayName: username,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      requireResidentKey: false,
    },
    timeout,
    attestation: 'none',
  };
}

// Create options for WebAuthn authentication
export function createAuthenticationOptions(
  challenge: string,
  rpId: string,
  allowCredentials: { id: string; type: 'public-key' }[] = [],
  timeout: number = 60000,
  userVerification: 'required' | 'preferred' | 'discouraged' = 'preferred',
) {
  return {
    challenge,
    rpId,
    allowCredentials,
    timeout,
    userVerification,
  };
}

// Extract credential ID from attestation
export function extractCredentialIdFromAttestation(attestationBuffer: Buffer): string {
  try {
    // This is a simplified version - actual implementation would need CBOR decoding
    // For full implementation, use a CBOR library like 'cbor' npm package
    const dataView = new DataView(attestationBuffer.buffer);
    
    // Skip format field (which would be 'none', 'packed', 'tpm', etc.)
    // This is very simplified and may not work with all attestation formats
    // A real implementation should use a WebAuthn library
    
    // Extract credentialId from attestationObject
    // In a real implementation, use a proper CBOR parser
    const credentialIdLength = dataView.getUint16(20, false); // example offset, not accurate
    const credentialIdStart = 22; // example offset, not accurate
    
    const credentialId = attestationBuffer.slice(credentialIdStart, credentialIdStart + credentialIdLength);
    return bufferToBase64URL(credentialId);
  } catch (error) {
    throw new Error('Failed to extract credential ID from attestation');
  }
}
