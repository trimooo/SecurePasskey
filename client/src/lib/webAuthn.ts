import { apiRequest } from './queryClient';
import { base64URLStringToBuffer, bufferToBase64URLString } from './auth';

// Keep track of the current challenge - use local variable for immediate access
let currentChallenge: string | null = null;

// Start WebAuthn registration
export async function startRegistration(email: string): Promise<PublicKeyCredentialCreationOptions> {
  try {
    // Clear any existing challenge state
    currentChallenge = null;
    
    const response = await apiRequest('POST', '/api/auth/register/start', { email });
    
    // Check if response is ok before attempting to read the body
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Registration start failed: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Log the received data for debugging
    console.log("Received registration options:", JSON.stringify(data, null, 2));
    
    // Save the original base64 challenge for verification later
    currentChallenge = data.challenge;
    console.log("Saved current challenge:", currentChallenge);
    
    // Convert base64URL-encoded values to ArrayBuffer as required by WebAuthn API
    const formattedData = {
      ...data,
      challenge: base64URLStringToBuffer(data.challenge),
      user: {
        ...data.user,
        id: base64URLStringToBuffer(data.user.id),
      },
      excludeCredentials: data.excludeCredentials ? data.excludeCredentials.map((credential: any) => ({
        ...credential,
        id: base64URLStringToBuffer(credential.id),
      })) : undefined
    };
    
    // Also store the challenge in session storage as a backup
    try {
      if (currentChallenge) {
        sessionStorage.setItem('webauthn_challenge', currentChallenge);
      }
    } catch (err) {
      console.warn("Could not store challenge in session storage:", err);
    }
    
    return formattedData;
  } catch (error) {
    console.error("Error in startRegistration:", error);
    throw error;
  }
}

// Complete WebAuthn registration
export async function completeRegistration(email: string, credential: any) {
  // Log stored challenge for debugging
  console.log("Using stored challenge for verification:", currentChallenge);
  
  // Convert ArrayBuffer to base64URL string for server
  const rawId = bufferToBase64URLString(credential.rawId);
  
  // Read clientDataJSON to check if the challenge matches what we expect
  const clientDataJSON = bufferToBase64URLString(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(credential.response.clientDataJSON));
  console.log("Client response challenge:", clientData.challenge);
  
  // Get backup challenge from session storage if needed
  if (!currentChallenge) {
    try {
      currentChallenge = sessionStorage.getItem('webauthn_challenge');
      console.log("Retrieved challenge from session storage:", currentChallenge);
    } catch (err) {
      console.warn("Could not retrieve challenge from session storage:", err);
    }
  }
  
  // Create the response object
  const response = {
    id: credential.id,
    rawId,
    type: credential.type,
    response: {
      attestationObject: bufferToBase64URLString(credential.response.attestationObject),
      clientDataJSON,
    },
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults,
    transports: credential.response.getTransports ? credential.response.getTransports() : undefined,
  };

  // Include the expected challenge directly
  return apiRequest('POST', '/api/auth/register/complete', { 
    email, 
    credential: response,
    expectedChallenge: currentChallenge // Pass the original challenge
  });
}

// Start WebAuthn login
export async function startLogin(email: string): Promise<PublicKeyCredentialRequestOptions> {
  try {
    // Clear any existing challenge state
    currentChallenge = null;
    
    const response = await apiRequest('POST', '/api/auth/login/start', { email });
    
    // Check if response is ok before attempting to read the body
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Login start failed: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Save the original base64 challenge for verification later
    currentChallenge = data.challenge;
    console.log("Saved current login challenge:", currentChallenge);
    
    // Convert base64URL-encoded challenge to ArrayBuffer as required by WebAuthn API
    const formattedData = {
      ...data,
      challenge: base64URLStringToBuffer(data.challenge),
      allowCredentials: data.allowCredentials ? data.allowCredentials.map((credential: any) => ({
        ...credential,
        id: base64URLStringToBuffer(credential.id),
      })) : undefined
    };
    
    // Also store the challenge in session storage as a backup
    try {
      if (currentChallenge) {
        sessionStorage.setItem('webauthn_login_challenge', currentChallenge);
      }
    } catch (err) {
      console.warn("Could not store login challenge in session storage:", err);
    }
    
    return formattedData;
  } catch (error) {
    console.error("Error in startLogin:", error);
    throw error;
  }
}

// Complete WebAuthn login
export async function completeLogin(email: string, credential: any) {
  // Log stored challenge for debugging
  console.log("Using stored login challenge for verification:", currentChallenge);
  
  // Convert ArrayBuffer to base64URL string for server
  const rawId = bufferToBase64URLString(credential.rawId);
  
  // Read clientDataJSON to check if the challenge matches what we expect
  const clientDataJSON = bufferToBase64URLString(credential.response.clientDataJSON);
  const clientData = JSON.parse(new TextDecoder().decode(credential.response.clientDataJSON));
  console.log("Client login response challenge:", clientData.challenge);
  
  // Get backup challenge from session storage if needed
  if (!currentChallenge) {
    try {
      currentChallenge = sessionStorage.getItem('webauthn_login_challenge');
      console.log("Retrieved login challenge from session storage:", currentChallenge);
    } catch (err) {
      console.warn("Could not retrieve login challenge from session storage:", err);
    }
  }
  
  // Create the response object
  const response = {
    id: credential.id,
    rawId,
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64URLString(credential.response.authenticatorData),
      clientDataJSON,
      signature: bufferToBase64URLString(credential.response.signature),
      userHandle: credential.response.userHandle ? bufferToBase64URLString(credential.response.userHandle) : null,
    },
    clientExtensionResults: credential.clientExtensionResults,
  };

  // Include the expected challenge directly
  return apiRequest('POST', '/api/auth/login/complete', { 
    email, 
    credential: response,
    expectedChallenge: currentChallenge // Pass the original challenge
  });
}

// Get QR code for login
export async function getQRCodeChallenge(email: string) {
  try {
    const response = await apiRequest('POST', '/api/auth/qrcode', { email });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QR code generation failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
}

// Verify QR code challenge
export async function verifyQRCode(challengeId: string) {
  try {
    const response = await apiRequest('POST', '/api/auth/qrcode/verify', { challengeId });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QR code verification failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error verifying QR code:", error);
    throw error;
  }
}
