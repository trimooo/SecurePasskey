import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function SuccessScreen() {
  const [_, setLocation] = useLocation();
  
  const handleContinue = () => {
    setLocation("/home");
  };
  
  return (
    <Card className="bg-white rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
      <CardContent className="pt-6">
        <div className="flex justify-center my-6">
          <div className="w-20 h-20 bg-[#34C759] bg-opacity-10 rounded-full flex items-center justify-center">
            <i className="fas fa-check-circle text-[#34C759] text-4xl"></i>
          </div>
        </div>
        
        <h2 className="text-xl font-semibold text-center mb-2">Authentication successful</h2>
        <p className="text-[#636366] text-center mb-6">
          You've been securely authenticated
        </p>
        
        <Button 
          onClick={handleContinue}
          className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 px-4 rounded-[22px] font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF]"
        >
          Continue to App
        </Button>
      </CardContent>
    </Card>
  );
}
