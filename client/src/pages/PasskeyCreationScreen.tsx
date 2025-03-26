import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { startRegistration, completeRegistration } from "@/lib/webAuthn";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from "@/lib/auth";

interface PasskeyCreationScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function PasskeyCreationScreen({ onBack, onSuccess }: PasskeyCreationScreenProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { email, setUser } = useAuth();
  
  // Check WebAuthn support on component mount
  useEffect(() => {
    const checkWebAuthnSupport = async () => {
      const isSupported = isWebAuthnSupported() && await isPlatformAuthenticatorAvailable();
      setIsWebAuthnAvailable(isSupported);
      
      if (!isSupported) {
        toast({
          title: "Device Not Supported",
          description: "Your device or browser does not support passkeys. Please use a compatible browser.",
          variant: "destructive",
        });
      }
    };
    
    checkWebAuthnSupport();
  }, [toast]);
  
  const handleCreatePasskey = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsCreating(true);
      
      // Start the registration process
      const options = await startRegistration(email);
      
      // Create the credential
      const credential = await navigator.credentials.create({
        publicKey: options as PublicKeyCredentialCreationOptions,
      });
      
      if (!credential) {
        throw new Error("Failed to create credential");
      }
      
      // Complete the registration
      const response = await completeRegistration(email, credential);
      const userData = await response.json();
      
      // Update user state
      setUser(userData.user);
      
      toast({
        title: "Success",
        description: "Passkey created successfully",
      });
      
      onSuccess();
    } catch (error) {
      console.error("Error creating passkey:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create passkey",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <Card className="bg-white rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
      <CardContent className="pt-6">
        <div className="flex items-center mb-5">
          <button className="text-[#007AFF] mr-2" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-semibold">Create a passkey</h2>
        </div>
        
        <div className="flex justify-center my-6">
          <div className="w-20 h-20 bg-[#F2F2F7] rounded-full flex items-center justify-center">
            <i className="fas fa-fingerprint text-[#636366] text-4xl"></i>
          </div>
        </div>
        
        <p className="text-center text-[#48484A] mb-6">
          Create a passkey to sign in more securely without passwords
        </p>
        
        <div className="space-y-4">
          <div className="bg-[#F2F2F7] rounded-xl p-4">
            <div className="flex items-start">
              <div className="mt-1">
                <i className="fas fa-shield-alt text-[#007AFF]"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-[#1C1C1E]">Stronger protection</h3>
                <p className="text-sm text-[#636366]">Passkeys offer better security than passwords.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-[#F2F2F7] rounded-xl p-4">
            <div className="flex items-start">
              <div className="mt-1">
                <i className="fas fa-mobile-alt text-[#007AFF]"></i>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-[#1C1C1E]">Device-based</h3>
                <p className="text-sm text-[#636366]">Securely stored on your device, not on servers.</p>
              </div>
            </div>
          </div>
        </div>
        
        <Button 
          onClick={handleCreatePasskey}
          disabled={isCreating || isWebAuthnAvailable === false}
          className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 px-4 rounded-[22px] font-medium mt-6 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF]"
        >
          {isCreating ? "Creating..." : "Create Passkey"}
        </Button>
      </CardContent>
    </Card>
  );
}
