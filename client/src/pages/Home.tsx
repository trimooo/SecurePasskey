import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

export default function Home() {
  const { user, logout } = useAuth();
  const [_, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Welcome to PassKey Auth</CardTitle>
          <CardDescription>You are now securely authenticated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-[#F2F2F7] p-4">
            <h3 className="font-medium text-sm mb-2">Account Information</h3>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Username:</span> {user?.username}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleLogout}
            className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 rounded-full py-5"
          >
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
