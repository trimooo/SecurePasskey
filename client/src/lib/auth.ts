// Base64URL string to buffer conversion
export function base64URLStringToBuffer(base64URLString: string): ArrayBuffer {
  // Convert from Base64URL to Base64
  const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  // Convert to binary string
  const binary = atob(padded);
  // Convert to buffer
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// Buffer to Base64URL string conversion
export function bufferToBase64URLString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Convert to Base64
  const base64 = btoa(binary);
  // Convert to Base64URL
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Format remaining time (mm:ss)
export function formatRemainingTime(expiryDate: Date): string {
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return "Expired";
  }
  
  // Calculate minutes and seconds
  const diffSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;
  
  // Format with leading zeros
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// Check if WebAuthn is supported by the browser
export function isWebAuthnSupported(): boolean {
  return window.PublicKeyCredential !== undefined;
}

// Check if the browser supports platform authenticators
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }
  
  return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}
