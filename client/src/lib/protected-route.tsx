import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { useEffect } from "react";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading, error } = useAuth();

  // Log authentication status for debugging
  useEffect(() => {
    console.log("Auth status:", { user: user ? "Authenticated" : "Not authenticated", isLoading, error });
  }, [user, isLoading, error]);

  // Show a loading indicator while checking authentication
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      </Route>
    );
  }

  // Handle authentication errors
  if (error) {
    console.error("Authentication error:", error);
  }

  // Redirect to auth page if not authenticated
  if (!user) {
    console.log("User not authenticated, redirecting to /auth");
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  console.log("User authenticated, rendering protected component");
  // Render the protected component if authenticated
  return (
    <Route path={path} component={Component} />
  );
}