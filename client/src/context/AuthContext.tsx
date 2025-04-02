import { createContext, ReactNode, useContext, useEffect } from "react";
import { useQuery, useMutation, UseMutationResult } from "@tanstack/react-query";
import { User, InsertUser } from "@shared/schema";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LoginData = {
  username: string;
  password: string;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  logoutMutation: UseMutationResult<void, Error, void>;
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

  const loginMutation = useMutation<User, Error, LoginData>({
    mutationFn: async (credentials) => {
      console.log("Login attempt with:", credentials.username);
      const response = await apiRequest("POST", "/api/login", credentials);
      return await response.json();
    },
    onSuccess: (userData) => {
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

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error: error as Error | null,
        loginMutation,
        registerMutation,
        logoutMutation,
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