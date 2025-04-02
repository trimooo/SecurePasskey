import { apiRequest } from './queryClient';
import { base64URLStringToBuffer, bufferToBase64URLString } from './auth';

// Start WebAuthn registration
export async function startRegistration(email: string): Promise<PublicKeyCredentialCreationOptions> {
  const response = await apiRequest('POST', '/api/auth/register/start', { email });
  const data = await response.json();
  
  // Log the received data for debugging
  console.log("Received registration options:", JSON.stringify(data, null, 2));
  
  // Convert base64URL-encoded values to ArrayBuffer as required by WebAuthn API
  data.challenge = base64URLStringToBuffer(data.challenge);
  data.user.id = base64URLStringToBuffer(data.user.id);
  
  if (data.excludeCredentials) {
    data.excludeCredentials = data.excludeCredentials.map((credential: any) => ({
      ...credential,
      id: base64URLStringToBuffer(credential.id),
    }));
  }
  
  // Store the challenge string in session storage to handle refresh cases
  try {
    sessionStorage.setItem('webauthn_challenge', data.challenge.toString());
  } catch (err) {
    console.warn("Could not store challenge in session storage:", err);
  }
  
  return data;
}

// Complete WebAuthn registration
export async function completeRegistration(email: string, credential: any) {
  // Convert ArrayBuffer to base64URL string for server
  const rawId = bufferToBase64URLString(credential.rawId);
  const response = {
    id: credential.id,
    rawId,
    type: credential.type,
    response: {
      attestationObject: bufferToBase64URLString(credential.response.attestationObject),
      clientDataJSON: bufferToBase64URLString(credential.response.clientDataJSON),
    },
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults,
    transports: credential.response.getTransports ? credential.response.getTransports() : undefined,
  };

  return apiRequest('POST', '/api/auth/register/complete', { email, credential: response });
}

// Start WebAuthn login
export async function startLogin(email: string): Promise<PublicKeyCredentialRequestOptions> {
  const response = await apiRequest('POST', '/api/auth/login/start', { email });
  const data = await response.json();
  
  // Convert base64URL-encoded challenge to ArrayBuffer as required by WebAuthn API
  data.challenge = base64URLStringToBuffer(data.challenge);
  
  if (data.allowCredentials) {
    data.allowCredentials = data.allowCredentials.map((credential: any) => ({
      ...credential,
      id: base64URLStringToBuffer(credential.id),
    }));
  }
  
  return data;
}

// Complete WebAuthn login
export async function completeLogin(email: string, credential: any) {
  // Convert ArrayBuffer to base64URL string for server
  const rawId = bufferToBase64URLString(credential.rawId);
  const response = {
    id: credential.id,
    rawId,
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64URLString(credential.response.authenticatorData),
      clientDataJSON: bufferToBase64URLString(credential.response.clientDataJSON),
      signature: bufferToBase64URLString(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64URLString(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.clientExtensionResults,
  };

  return apiRequest('POST', '/api/auth/login/complete', { email, credential: response });
}

// Get QR code for login
export async function getQRCodeChallenge(email: string) {
  const response = await apiRequest('POST', '/api/auth/qrcode', { email });
  return response.json();
}

// Verify QR code challenge
export async function verifyQRCode(challengeId: string) {
  const response = await apiRequest('POST', '/api/auth/qrcode/verify', { challengeId });
  return response.json();
}
