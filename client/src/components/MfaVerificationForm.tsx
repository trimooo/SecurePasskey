import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type MfaResponse = {
  requiresMfa: boolean;
  mfaType: string;
  userId: number;
  verificationCode?: string; // Only for development
  expiresAt?: string;
  message: string;
};

interface MfaVerificationFormProps {
  mfaData: MfaResponse;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaVerificationForm({ mfaData, onSuccess, onCancel }: MfaVerificationFormProps) {
  const { verifyMfaMutation } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code) {
      toast({
        title: "Verification code required",
        description: "Please enter the verification code to continue",
        variant: "destructive"
      });
      return;
    }
    
    verifyMfaMutation.mutate(
      {
        userId: mfaData.userId,
        code,
        mfaType: mfaData.mfaType as 'totp' | 'email' | 'sms' | 'recovery',
      },
      {
        onSuccess: () => {
          toast({
            title: "Verification successful",
            description: "You have been successfully authenticated",
          });
          onSuccess();
        },
      }
    );
  };
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardDescription>
          Enter the verification code to complete your login
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {verifyMfaMutation.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {verifyMfaMutation.error.message || 'Verification failed. Please try again.'}
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              placeholder="Enter code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              className="text-center tracking-widest text-lg"
            />
            
            {mfaData.verificationCode && (
              <Alert className="mt-2">
                <AlertDescription className="text-sm text-muted-foreground">
                  Development code: <span className="font-mono font-bold">{mfaData.verificationCode}</span>
                </AlertDescription>
              </Alert>
            )}
            
            {mfaData.expiresAt && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Code expires at {new Date(mfaData.expiresAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          
          <div className="pt-2">
            <Button
              type="submit"
              className="w-full"
              disabled={verifyMfaMutation.isPending}
            >
              {verifyMfaMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      
      <CardFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full"
          disabled={verifyMfaMutation.isPending}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}