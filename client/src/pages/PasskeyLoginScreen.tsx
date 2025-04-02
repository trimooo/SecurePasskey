import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { startLogin, completeLogin } from "@/lib/webAuthn";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

interface PasskeyLoginScreenProps {
  onBack: () => void;
  onShowQR: () => void;
  onSuccess: () => void;
}

export default function PasskeyLoginScreen({ onBack, onShowQR, onSuccess }: PasskeyLoginScreenProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();
  const { email, setUser } = useAuth();
  
  const handleUsePasskey = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoggingIn(true);
      
      // Start the login process
      let options;
      try {
        options = await startLogin(email);
      } catch (error) {
        console.error("Error starting login:", error);
        toast({
          title: "Login Error",
          description: "Could not initiate login. Your account might not have a passkey or the server is unavailable.",
          variant: "destructive",
        });
        return;
      }
      
      // Get the credential
      let credential;
      try {
        credential = await navigator.credentials.get({
          publicKey: options as PublicKeyCredentialRequestOptions,
        });
      } catch (error) {
        console.error("Credential retrieval error:", error);
        
        // Handle specific WebAuthn errors
        if (error instanceof DOMException) {
          if (error.name === "NotAllowedError") {
            toast({
              title: "Authentication Declined",
              description: "You declined the authentication request. Please try again.",
              variant: "destructive",
            });
          } else if (error.name === "AbortError") {
            toast({
              title: "Operation Canceled",
              description: "The authentication operation was canceled. Please try again.",
              variant: "destructive",
            });
          } else if (error.name === "NotFoundError") {
            toast({
              title: "Passkey Not Found",
              description: "No passkey was found for this account on this device. Try using QR code login.",
              variant: "default",
            });
            // Automatically show QR code option
            setTimeout(() => onShowQR(), 1500);
          } else {
            toast({
              title: "Authentication Error",
              description: `${error.name}: ${error.message}`,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Login Error",
            description: "Failed to authenticate. Your device might not be compatible.",
            variant: "destructive",
          });
        }
        return;
      }
      
      if (!credential) {
        toast({
          title: "Authentication Failed",
          description: "No credential was provided. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Complete the login
      try {
        const result = await completeLogin(email, credential);
        
        // Update user state
        setUser(result.user);
        
        toast({
          title: "Success",
          description: "Successfully authenticated",
        });
        
        onSuccess();
      } catch (error) {
        console.error("Error completing login:", error);
        toast({
          title: "Login Error",
          description: "Could not complete authentication. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Unexpected error during login:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  return (
    <Card className="bg-white rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
      <CardContent className="pt-6">
        <div className="flex items-center mb-5">
          <button className="text-[#007AFF] mr-2" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-semibold">Sign in with passkey</h2>
        </div>
        
        <p className="text-[#636366] text-sm mb-6">
          Use your passkey to sign in securely to <span className="font-medium text-[#48484A]">{email}</span>
        </p>
        
        <div className="flex justify-center my-6">
          <Button 
            onClick={handleUsePasskey}
            disabled={isLoggingIn}
            className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 px-4 rounded-[22px] font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF]"
          >
            {isLoggingIn ? "Authenticating..." : "Use Passkey"}
          </Button>
        </div>
        
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-sm text-[#8E8E93]">or</span>
          </div>
        </div>
        
        <div className="mt-4">
          <Button 
            onClick={onShowQR}
            variant="outline" 
            className="w-full bg-white border border-[#E5E5EA] text-[#1C1C1E] py-3 px-4 rounded-[22px] font-medium hover:bg-[#F2F2F7] transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF] flex items-center justify-center"
          >
            <i className="fas fa-qrcode mr-2"></i>
            Sign in with QR code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
