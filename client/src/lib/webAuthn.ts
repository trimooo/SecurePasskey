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
      let errorMessage;
      try {
        // Try to parse as JSON first
        const errorData = await response.json();
        errorMessage = errorData.message || `Registration start failed with status ${response.status}`;
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorMessage = await response.text();
        } catch (textError) {
          // If both fail, use a generic error
          errorMessage = `Registration start failed with status ${response.status}`;
        }
      }
      throw new Error(errorMessage);
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
    clientExtensionResults: credential.clientExtensionResults || {},
    transports: credential.response.getTransports ? credential.response.getTransports() : undefined,
  };

  // Include the expected challenge directly and handle the response properly
  const apiResponse = await apiRequest('POST', '/api/auth/register/complete', { 
    email, 
    credential: response,
    expectedChallenge: currentChallenge // Pass the original challenge
  });
  
  if (!apiResponse.ok) {
    let errorMessage;
    try {
      // Try to parse as JSON first
      const errorData = await apiResponse.json();
      errorMessage = errorData.message || `Registration complete failed with status ${apiResponse.status}`;
    } catch (e) {
      // If JSON parsing fails, try to get text
      try {
        errorMessage = await apiResponse.text();
      } catch (textError) {
        // If both fail, use a generic error
        errorMessage = `Registration complete failed with status ${apiResponse.status}`;
      }
    }
    throw new Error(errorMessage);
  }
  
  return await apiResponse.json();
}

// Start WebAuthn login
export async function startLogin(email: string): Promise<PublicKeyCredentialRequestOptions> {
  try {
    // Clear any existing challenge state
    currentChallenge = null;
    
    const response = await apiRequest('POST', '/api/auth/login/start', { email });
    
    // Check if response is ok before attempting to read the body
    if (!response.ok) {
      let errorMessage;
      try {
        // Try to parse as JSON first
        const errorData = await response.json();
        errorMessage = errorData.message || `Login start failed with status ${response.status}`;
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorMessage = await response.text();
        } catch (textError) {
          // If both fail, use a generic error
          errorMessage = `Login start failed with status ${response.status}`;
        }
      }
      throw new Error(errorMessage);
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
    // Ensure clientExtensionResults is always a valid object even if undefined
    clientExtensionResults: credential.clientExtensionResults || {},
  };

  // Include the expected challenge directly and handle the response properly
  const apiResponse = await apiRequest('POST', '/api/auth/login/complete', { 
    email, 
    credential: response,
    expectedChallenge: currentChallenge // Pass the original challenge
  });
  
  if (!apiResponse.ok) {
    let errorMessage;
    try {
      // Try to parse as JSON first
      const errorData = await apiResponse.json();
      errorMessage = errorData.message || `Login failed with status ${apiResponse.status}`;
    } catch (e) {
      // If JSON parsing fails, try to get text
      try {
        errorMessage = await apiResponse.text();
      } catch (textError) {
        // If both fail, use a generic error
        errorMessage = `Login failed with status ${apiResponse.status}`;
      }
    }
    throw new Error(errorMessage);
  }
  
  return await apiResponse.json();
}

// Get QR code for login
export async function getQRCodeChallenge(email?: string) {
  try {
    // Email is now optional - server supports anonymous QR codes
    const payload = email ? { email } : {};
    const response = await apiRequest('POST', '/api/auth/qrcode', payload);
    
    if (!response.ok) {
      let errorMessage;
      try {
        // Try to parse as JSON first
        const errorData = await response.json();
        errorMessage = errorData.message || `QR code generation failed with status ${response.status}`;
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorMessage = await response.text();
        } catch (textError) {
          // If both fail, use a generic error
          errorMessage = `QR code generation failed with status ${response.status}`;
        }
      }
      throw new Error(errorMessage);
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
      let errorMessage;
      try {
        // Try to parse as JSON first
        const errorData = await response.json();
        errorMessage = errorData.message || `QR code verification failed with status ${response.status}`;
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorMessage = await response.text();
        } catch (textError) {
          // If both fail, use a generic error
          errorMessage = `QR code verification failed with status ${response.status}`;
        }
      }
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error verifying QR code:", error);
    throw error;
  }
}
