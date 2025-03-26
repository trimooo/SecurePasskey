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
      const options = await startLogin(email);
      
      // Get the credential
      const credential = await navigator.credentials.get({
        publicKey: options as PublicKeyCredentialRequestOptions,
      });
      
      if (!credential) {
        throw new Error("Failed to get credential");
      }
      
      // Complete the login
      const response = await completeLogin(email, credential);
      const userData = await response.json();
      
      // Update user state
      setUser(userData.user);
      
      toast({
        title: "Success",
        description: "Successfully authenticated",
      });
      
      onSuccess();
    } catch (error) {
      console.error("Error during login:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to authenticate",
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
