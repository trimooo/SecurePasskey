import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  email: string;
  isAuthenticated: boolean;
  isRegistered: boolean;
  setEmail: (email: string) => void;
  setUser: (user: User | null) => void;
  setIsRegistered: (isRegistered: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const { toast } = useToast();

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsRegistered(false);
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        email,
        isAuthenticated,
        isRegistered,
        setEmail,
        setUser: (newUser) => {
          setUser(newUser);
          setIsAuthenticated(!!newUser);
          setIsRegistered(!!newUser?.registered);
        },
        setIsRegistered,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
