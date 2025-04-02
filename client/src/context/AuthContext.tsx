import { createContext, ReactNode, useContext, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = {
  username: string;
  password: string;
};

type MfaVerifyData = {
  userId: number;
  code: string;
  mfaType: 'totp' | 'email' | 'sms' | 'recovery';
};

type MfaSetupData = {
  type: 'totp' | 'email' | 'sms';
};

type MfaEnableData = {
  type: 'totp' | 'email' | 'sms';
  code: string;
  secret?: string;
};

type MfaDisableData = {
  password: string;
};

type MfaResponse = {
  requiresMfa: boolean;
  mfaType: string;
  userId: number;
  verificationCode?: string; // Only for development
  expiresAt?: string;
  message: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User | MfaResponse, Error, LoginData>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  logoutMutation: UseMutationResult<void, Error, void>;
  verifyMfaMutation: UseMutationResult<User, Error, MfaVerifyData>;
  setupMfaMutation: UseMutationResult<any, Error, MfaSetupData>;
  enableMfaMutation: UseMutationResult<User, Error, MfaEnableData>;
  disableMfaMutation: UseMutationResult<User, Error, MfaDisableData>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  const { 
    data: user, 
    isLoading, 
    error, 
    refetch 
  } = useQuery<User | null>({
    queryKey: ['/api/user'],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 1,
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Log the query status for debugging
  useEffect(() => {
    console.log("Auth query status:", { 
      user: user ? `Logged in as ${user.username}` : "Not logged in", 
      isLoading, 
      error: error ? error.message : null 
    });
  }, [user, isLoading, error]);

  const loginMutation = useMutation<User | MfaResponse, Error, LoginData>({
    mutationFn: async (credentials) => {
      console.log("Login attempt with:", credentials.username);
      const response = await apiRequest("POST", "/api/login", credentials);
      return await response.json();
    },
    onSuccess: (data) => {
      // Check if response indicates MFA is required
      if (data && 'requiresMfa' in data && data.requiresMfa) {
        console.log("MFA required for login:", data.mfaType);
        toast({
          title: "MFA Verification Required",
          description: data.message || `Please verify with your ${data.mfaType} authentication.`,
        });
        // The MFA response data will be available to the component through mutation.data
        return;
      }
      
      // Regular successful login
      const userData = data as User;
      console.log("Login successful:", userData);
      queryClient.setQueryData(['/api/user'], userData);
      refetch(); // Ensure we have fresh user data
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.username}!`,
      });
    },
    onError: (error) => {
      console.error("Login failed:", error);
      toast({
        title: "Login failed",
        description: error.message || 'An unknown error occurred',
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<User, Error, InsertUser>({
    mutationFn: async (userData) => {
      console.log("Registration attempt for:", userData.username);
      const response = await apiRequest("POST", "/api/register", userData);
      return await response.json();
    },
    onSuccess: (userData) => {
      console.log("Registration successful:", userData);
      queryClient.setQueryData(['/api/user'], userData);
      refetch(); // Ensure we have fresh user data
      toast({
        title: "Registration successful",
        description: `Welcome, ${userData.username}!`,
      });
    },
    onError: (error) => {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error.message || 'An unknown error occurred',
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      console.log("Logout attempt");
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      console.log("Logout successful");
      queryClient.setQueryData(['/api/user'], null);
      refetch(); // Ensure we refresh the user state
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error) => {
      console.error("Logout failed:", error);
      toast({
        title: "Logout failed",
        description: error.message || 'An unknown error occurred',
        variant: "destructive",
      });
    },
  });
  
  // MFA verify mutation (used when user needs to input MFA code during login)
  const verifyMfaMutation = useMutation<User, Error, MfaVerifyData>({
    mutationFn: async (verifyData) => {
      console.log("MFA verify attempt for user:", verifyData.userId);
      const response = await apiRequest("POST", "/api/mfa/verify", verifyData);
      return await response.json();
    },
    onSuccess: (userData) => {
      console.log("MFA verification successful");
      queryClient.setQueryData(['/api/user'], userData);
      refetch(); // Ensure we have fresh user data
      toast({
        title: "Verification successful",
        description: "Authentication completed successfully.",
      });
    },
    onError: (error) => {
      console.error("MFA verification failed:", error);
      toast({
        title: "Verification failed",
        description: error.message || 'Invalid verification code',
        variant: "destructive",
      });
    },
  });
  
  // MFA setup mutation (used to initiate MFA setup)
  const setupMfaMutation = useMutation<any, Error, MfaSetupData>({
    mutationFn: async (setupData) => {
      console.log("MFA setup attempt for type:", setupData.type);
      const response = await apiRequest("POST", "/api/mfa/setup", setupData);
      return await response.json();
    },
    onSuccess: (data) => {
      console.log("MFA setup initiated successfully");
      toast({
        title: "MFA Setup",
        description: "Please complete the verification process to enable MFA",
      });
    },
    onError: (error) => {
      console.error("MFA setup failed:", error);
      toast({
        title: "MFA setup failed",
        description: error.message || 'An error occurred during setup',
        variant: "destructive",
      });
    },
  });
  
  // MFA enable mutation (used to complete MFA setup with verification)
  const enableMfaMutation = useMutation<User, Error, MfaEnableData>({
    mutationFn: async (enableData) => {
      console.log("MFA enable attempt");
      const response = await apiRequest("POST", "/api/mfa/enable", enableData);
      return await response.json();
    },
    onSuccess: (userData) => {
      console.log("MFA enabled successfully");
      queryClient.setQueryData(['/api/user'], userData);
      refetch(); // Ensure we have fresh user data
      toast({
        title: "MFA Enabled",
        description: "Multi-factor authentication has been enabled for your account.",
      });
    },
    onError: (error) => {
      console.error("MFA enable failed:", error);
      toast({
        title: "Failed to enable MFA",
        description: error.message || 'Verification failed',
        variant: "destructive",
      });
    },
  });
  
  // MFA disable mutation
  const disableMfaMutation = useMutation<User, Error, MfaDisableData>({
    mutationFn: async (disableData) => {
      console.log("MFA disable attempt");
      const response = await apiRequest("POST", "/api/mfa/disable", disableData);
      return await response.json();
    },
    onSuccess: (userData) => {
      console.log("MFA disabled successfully");
      queryClient.setQueryData(['/api/user'], userData);
      refetch(); // Ensure we have fresh user data
      toast({
        title: "MFA Disabled",
        description: "Multi-factor authentication has been disabled for your account.",
      });
    },
    onError: (error) => {
      console.error("MFA disable failed:", error);
      toast({
        title: "Failed to disable MFA",
        description: error.message || 'Invalid password',
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error: error as Error | null,
        loginMutation,
        registerMutation,
        logoutMutation,
        verifyMfaMutation,
        setupMfaMutation,
        enableMfaMutation,
        disableMfaMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}