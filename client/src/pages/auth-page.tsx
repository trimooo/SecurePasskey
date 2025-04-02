import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeySquare, ShieldAlert, UserRoundCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MfaVerificationForm from '@/components/MfaVerificationForm';

// Define MfaResponse type
type MfaResponse = {
  requiresMfa: boolean;
  mfaType: string;
  userId: number;
  verificationCode?: string;
  expiresAt?: string;
  message: string;
};

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, error, loginMutation, registerMutation, verifyMfaMutation } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [activeTab, setActiveTab] = useState('login');
  
  // MFA verification state
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaData, setMfaData] = useState<MfaResponse | null>(null);
  
  // Debug - log auth state changes
  useEffect(() => {
    console.log('Auth page state:', { 
      user: user ? `User: ${user.username}` : 'No user', 
      isLoading, 
      loginPending: loginMutation.isPending,
      registerPending: registerMutation.isPending,
      error 
    });
    
    // If user is logged in, redirect to home
    if (user && !isLoading) {
      console.log('User logged in, redirecting to home');
      setLocation('/');
    }
  }, [user, isLoading, loginMutation.isPending, registerMutation.isPending, error, setLocation]);
  
  // Check for MFA requirements after login attempt
  useEffect(() => {
    // Only run this when the login mutation has completed
    if (!loginMutation.isPending && loginMutation.data && 'requiresMfa' in loginMutation.data) {
      console.log('MFA required:', loginMutation.data);
      setMfaData(loginMutation.data as MfaResponse);
      setShowMfaVerification(true);
    }
  }, [loginMutation.isPending, loginMutation.data]);

  // Separate login handler
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: 'Invalid input',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Attempting login with username:', username);
    
    // Use the username directly for login
    loginMutation.mutate({ 
      username, 
      password 
    });
  };

  // Separate register handler
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) {
      toast({
        title: 'Invalid input',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }
    
    console.log('Attempting registration with username:', username, 'and email:', email);
    
    // Register with provided details
    registerMutation.mutate({ 
      username, 
      password,
      email,
      registered: true,
      // Name is optional in the schema
      ...(name ? { name } : {})
    });
  };

  // Handle successful MFA verification
  const handleMfaSuccess = () => {
    setShowMfaVerification(false);
    setMfaData(null);
  };
  
  // Handle MFA verification cancelation
  const handleMfaCancel = () => {
    setShowMfaVerification(false);
    setMfaData(null);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Auth form section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        {showMfaVerification && mfaData ? (
          <MfaVerificationForm 
            mfaData={mfaData}
            onSuccess={handleMfaSuccess}
            onCancel={handleMfaCancel}
          />
        ) : (
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Authentication</CardTitle>
              <CardDescription>
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              {loginMutation.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {loginMutation.error.message || 'Login failed. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}
              
              {registerMutation.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    {registerMutation.error.message || 'Registration failed. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}
              
              <TabsContent value="login">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      type="text" 
                      placeholder="yourusername" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      type="text" 
                      placeholder="yourusername" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name (optional)</Label>
                    <Input 
                      id="name" 
                      type="text" 
                      placeholder="John Doe" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Creating account...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center text-sm text-gray-500">
            Secure authentication with PassKeys
          </CardFooter>
        </Card>
        )}
      </div>
      
      {/* Hero section */}
      <div className="w-full md:w-1/2 bg-gradient-to-r from-primary/20 to-primary/10 p-8 flex flex-col justify-center">
        <div className="max-w-md mx-auto space-y-8">
          <h1 className="text-4xl font-bold">Secure Password Manager</h1>
          <p className="text-lg">
            Keep all your passwords secure with advanced encryption and authentication.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <KeySquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Passkey Support</h3>
                <p className="text-sm text-gray-600">
                  Use biometrics and secure keys for stronger authentication
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <ShieldAlert className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">Security Analysis</h3>
                <p className="text-sm text-gray-600">
                  Get insights on password strength and potential vulnerabilities
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-primary/10 p-2 rounded-lg">
                <UserRoundCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">QR Code Login</h3>
                <p className="text-sm text-gray-600">
                  Quickly sign in with QR code scanning from your mobile device
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}