import { useState } from "react";
import { SavedPassword } from "@shared/schema";
import { Copy, Edit, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PasswordCardProps {
  password: SavedPassword;
  onEdit: (password: SavedPassword) => void;
  onDelete: (id: number) => void;
}

export function PasswordCard({ password, onEdit, onDelete }: PasswordCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${field} has been copied`,
      duration: 2000,
    });
  };

  const openWebsite = (url: string) => {
    if (!url) return;
    
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      finalUrl = 'https://' + url;
    }
    
    window.open(finalUrl, '_blank');
  };

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-medium text-lg">{password.website}</h3>
            {password.url && (
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-0 text-gray-500 hover:text-blue-600"
                  onClick={() => openWebsite(password.url!)}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[200px]">{password.url}</span>
                </Button>
              </div>
            )}
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full"
              onClick={() => onEdit(password)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(password.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500">Username</span>
            <div className="flex items-center space-x-1">
              <span className="text-sm truncate max-w-[180px]">{password.username}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 rounded-full"
                onClick={() => copyToClipboard(password.username, "Username")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500">Password</span>
            <div className="flex items-center space-x-1">
              <span className="text-sm max-w-[180px] truncate">
                {showPassword ? password.password : "••••••••••••"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 rounded-full"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 rounded-full"
                onClick={() => copyToClipboard(password.password, "Password")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {password.notes && (
            <div className="pt-2 mt-2 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm">{password.notes}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}