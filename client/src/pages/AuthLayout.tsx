import { useState, useEffect } from "react";
import EmailInputScreen from "./EmailInputScreen";
import PasskeyCreationScreen from "./PasskeyCreationScreen";
import PasskeyLoginScreen from "./PasskeyLoginScreen";
import QRCodeLoginScreen from "./QRCodeLoginScreen";
import SuccessScreen from "./SuccessScreen";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

type Screen = "email" | "passkeyCreation" | "passkeyLogin" | "qrLogin" | "success";

export default function AuthLayout() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("email");
  const { isAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && currentScreen === "success") {
      const timer = setTimeout(() => {
        setLocation("/home");
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, currentScreen, setLocation]);

  return (
    <div className="flex-1 flex flex-col justify-center items-center min-h-screen bg-[#F2F2F7] p-6">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 bg-[#007AFF] rounded-2xl flex items-center justify-center shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
            <i className="fas fa-key text-white text-3xl"></i>
          </div>
        </div>
        
        {/* App Title */}
        <h1 className="text-2xl font-semibold text-center text-[#1C1C1E] mb-1">PassKey Auth</h1>
        <p className="text-[#636366] text-center mb-10">Secure, passwordless authentication</p>
        
        {/* Screens */}
        <div className="auth-container">
          {currentScreen === "email" && (
            <EmailInputScreen onNext={(isRegistered) => 
              setCurrentScreen(isRegistered ? "passkeyLogin" : "passkeyCreation")
            } />
          )}
          
          {currentScreen === "passkeyCreation" && (
            <PasskeyCreationScreen 
              onBack={() => setCurrentScreen("email")}
              onSuccess={() => setCurrentScreen("success")} 
            />
          )}
          
          {currentScreen === "passkeyLogin" && (
            <PasskeyLoginScreen 
              onBack={() => setCurrentScreen("email")}
              onShowQR={() => setCurrentScreen("qrLogin")}
              onSuccess={() => setCurrentScreen("success")} 
            />
          )}
          
          {currentScreen === "qrLogin" && (
            <QRCodeLoginScreen 
              onBack={() => setCurrentScreen("passkeyLogin")}
              onSuccess={() => setCurrentScreen("success")} 
            />
          )}
          
          {currentScreen === "success" && (
            <SuccessScreen />
          )}
        </div>
      </div>
      
      <footer className="py-6 text-center text-[#8E8E93] text-sm mt-auto">
        <p>© {new Date().getFullYear()} PassKey Auth. All rights reserved.</p>
      </footer>
    </div>
  );
}
