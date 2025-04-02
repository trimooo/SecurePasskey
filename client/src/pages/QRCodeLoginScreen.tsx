import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQRCodeChallenge, verifyQRCode } from "@/lib/webAuthn";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { formatRemainingTime } from "@/lib/auth";
import QRCode from "qrcode";

interface QRCodeLoginScreenProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function QRCodeLoginScreen({ onBack, onSuccess }: QRCodeLoginScreenProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [challenge, setChallenge] = useState<{id: string, qrCode: string, expiresAt: string} | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("5:00");
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { email, setUser } = useAuth();
  
  // Generate QR code challenge
  const generateQRCode = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Stop previous polling and timer
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      
      let data;
      try {
        data = await getQRCodeChallenge(email);
      } catch (error) {
        console.error("Error fetching QR challenge:", error);
        toast({
          title: "Service Unavailable",
          description: "Could not generate QR code. Please try again later.",
          variant: "destructive",
        });
        return;
      }
      
      if (!data || !data.qrCode) {
        console.error("Invalid QR code data:", data);
        toast({
          title: "Error",
          description: "Received invalid QR code data from server",
          variant: "destructive",
        });
        return;
      }
      
      setChallenge(data);
      
      // Generate QR code image
      if (qrCanvasRef.current && data.qrCode) {
        try {
          await QRCode.toCanvas(qrCanvasRef.current, data.qrCode, {
            width: 192,
            margin: 0,
            color: {
              dark: '#1C1C1E',
              light: '#FFFFFF'
            }
          });
        } catch (qrError) {
          console.error("QR code generation error:", qrError);
          toast({
            title: "QR Rendering Error",
            description: "Could not render QR code. Please try again.",
            variant: "destructive",
          });
          return;
        }
      } else {
        console.error("QR canvas reference not available");
        toast({
          title: "QR Code Error",
          description: "Could not create QR code display",
          variant: "destructive",
        });
        return;
      }
      
      // Start polling for verification
      startPolling(data.id);
      
      // Start countdown timer
      startTimer(new Date(data.expiresAt));
      
      toast({
        title: "QR Code Ready",
        description: "Scan with your other device to log in",
      });
    } catch (error) {
      console.error("Unexpected error generating QR code:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start polling for QR code verification
  const startPolling = (challengeId: string) => {
    // Clear existing polling interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    let failedAttempts = 0;
    const maxFailedAttempts = 3;
    
    // Poll every 2 seconds to check if QR code has been verified
    pollingRef.current = setInterval(async () => {
      try {
        const response = await verifyQRCode(challengeId);
        
        // Reset failed attempts counter
        failedAttempts = 0;
        
        if (response.verified) {
          // Stop polling and update user
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          // Stop the timer
          if (timerRef.current) clearInterval(timerRef.current);
          
          // Update authentication state
          setUser(response.user);
          
          toast({
            title: "Success",
            description: "QR code authentication successful",
          });
          
          onSuccess();
        }
      } catch (error) {
        failedAttempts++;
        console.error(`Error verifying QR code (attempt ${failedAttempts}/${maxFailedAttempts}):`, error);
        
        if (failedAttempts >= maxFailedAttempts) {
          // If we've had too many failed attempts, stop polling
          if (pollingRef.current) clearInterval(pollingRef.current);
          
          toast({
            title: "Connection Issue",
            description: "Verification service is unavailable. Try refreshing the QR code.",
            variant: "destructive",
          });
        }
      }
    }, 2000);
  };
  
  // Start countdown timer
  const startTimer = (expiryDate: Date) => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Update timer every second
    timerRef.current = setInterval(() => {
      const remaining = formatRemainingTime(expiryDate);
      setTimeRemaining(remaining);
      
      if (remaining === "Expired") {
        clearInterval(timerRef.current!);
        toast({
          title: "QR Code Expired",
          description: "Please generate a new QR code",
        });
      }
    }, 1000);
  };
  
  // Clean up intervals on unmount
  useEffect(() => {
    // Generate QR code on mount
    generateQRCode();
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
  
  return (
    <Card className="bg-white rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
      <CardContent className="pt-6">
        <div className="flex items-center mb-5">
          <button className="text-[#007AFF] mr-2" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="text-xl font-semibold">Scan QR code to sign in</h2>
        </div>
        
        <p className="text-[#636366] text-sm mb-6">
          Scan this QR code with another device where you're already signed in
        </p>
        
        <div className="flex justify-center my-6">
          <div className="border-2 border-[#E5E5EA] rounded-lg p-3 bg-white inline-block">
            {isLoading ? (
              <div className="h-48 w-48 bg-white flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-[#007AFF] rounded-full border-t-transparent"></div>
              </div>
            ) : (
              <canvas ref={qrCanvasRef} className="h-48 w-48" />
            )}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-[#636366] text-sm mb-1">QR code expires in</p>
          <p className="text-[#1C1C1E] font-medium text-lg">{timeRemaining}</p>
        </div>
        
        <Button 
          onClick={generateQRCode}
          disabled={isLoading}
          variant="outline" 
          className="w-full border border-[#E5E5EA] text-[#007AFF] py-3 px-4 rounded-[22px] font-medium mt-4 hover:bg-[#F2F2F7] transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF] flex items-center justify-center"
        >
          <i className="fas fa-sync-alt mr-2"></i>
          Refresh QR Code
        </Button>
      </CardContent>
    </Card>
  );
}
