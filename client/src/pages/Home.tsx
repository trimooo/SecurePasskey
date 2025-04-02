import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, X, LogOut, ShieldAlert } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { PasswordForm } from "@/components/ui/password-form";
import { PasswordCard } from "@/components/ui/password-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SecurityReport } from "@/components/ui/security-report";
import { apiRequest } from "@/lib/queryClient";
import { SavedPassword } from "@shared/schema";

export default function Home() {
  const { user, logoutMutation } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for managing UI components
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingPassword, setIsAddingPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState<SavedPassword | null>(null);
  const [deletePasswordId, setDeletePasswordId] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch saved passwords
  const { 
    data: passwords = [], 
    isLoading, 
    isError, 
    error
  } = useQuery<SavedPassword[]>({
    queryKey: ['/api/passwords'],
    refetchOnWindowFocus: false,
  });

  // Mutation for deleting passwords
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/passwords/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete password');
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/passwords'] });
      toast({
        title: "Password deleted",
        description: "Your saved password has been deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete password",
        variant: "destructive",
      });
    },
  });

  // Filter passwords based on search term
  const filteredPasswords = passwords ? passwords.filter((password) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      password.website.toLowerCase().includes(searchLower) ||
      password.username.toLowerCase().includes(searchLower) ||
      (password.url && password.url.toLowerCase().includes(searchLower)) ||
      (password.notes && password.notes.toLowerCase().includes(searchLower))
    );
  }) : [];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  const handleEditPassword = (password: SavedPassword) => {
    setEditingPassword(password);
    setIsAddingPassword(true);
  };

  const handleDeletePassword = (id: number) => {
    setDeletePasswordId(id);
    setShowConfirmDialog(true);
  };

  const confirmDeletePassword = () => {
    if (deletePasswordId) {
      deleteMutation.mutate(deletePasswordId);
    }
  };

  const handleSavePassword = () => {
    setIsAddingPassword(false);
    setEditingPassword(null);
    queryClient.invalidateQueries({ queryKey: ['/api/passwords'] });
    toast({
      title: "Success",
      description: "Your password has been saved.",
    });
  };

  const handleCancelForm = () => {
    setIsAddingPassword(false);
    setEditingPassword(null);
  };

  if (isError) {
    console.error('Error loading passwords:', error);
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <ShieldCheck className="h-6 w-6 mr-2 text-[#007AFF]" />
              PassKey Manager
            </h1>
            <p className="text-gray-600 mt-1">Securely store and manage your passwords</p>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            <Button 
              variant="outline" 
              className="rounded-full"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </header>

        <div className="mb-6 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center space-x-2">
            <div className="h-10 w-10 rounded-full bg-[#E5F1FF] flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="font-medium">Welcome, {user?.username}</h2>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
            <TabsList className="h-9 bg-gray-100 rounded-lg p-1">
              <TabsTrigger value="all" className="rounded-md px-3 py-1 data-[state=active]:bg-white">
                <ShieldCheck className="h-4 w-4 mr-1 inline-block" />
                All Passwords
              </TabsTrigger>
              <TabsTrigger value="recent" className="rounded-md px-3 py-1 data-[state=active]:bg-white">
                <Search className="h-4 w-4 mr-1 inline-block" />
                Recently Used
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-md px-3 py-1 data-[state=active]:bg-white">
                <ShieldAlert className="h-4 w-4 mr-1 inline-block" />
                Security Report
              </TabsTrigger>
            </TabsList>
            
            <div className="flex w-full sm:w-auto space-x-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search passwords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full rounded-full border-gray-200"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                )}
              </div>
              
              <Button
                onClick={() => {
                  setEditingPassword(null);
                  setIsAddingPassword(true);
                }}
                className="bg-[#007AFF] hover:bg-[#007AFF]/90 rounded-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
          </div>
          
          <TabsContent value="all" className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-32 animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPasswords.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-[#E5F1FF] flex items-center justify-center mb-4">
                    <ShieldCheck className="h-6 w-6 text-[#007AFF]" />
                  </div>
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? "No matching passwords found" : "No saved passwords yet"}
                </h3>
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  {searchTerm
                    ? "Try a different search term or clear your search."
                    : "Add your first password by clicking the 'Add New' button above."}
                </p>
                {searchTerm ? (
                  <Button
                    variant="outline"
                    onClick={() => setSearchTerm("")}
                    className="rounded-full"
                  >
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditingPassword(null);
                      setIsAddingPassword(true);
                    }}
                    className="bg-[#007AFF] hover:bg-[#007AFF]/90 rounded-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Password
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {filteredPasswords.map((password) => (
                  <PasswordCard
                    key={password.id}
                    password={password}
                    onEdit={handleEditPassword}
                    onDelete={handleDeletePassword}
                  />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="recent" className="mt-0">
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-[#E5F1FF] flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6 text-[#007AFF]" />
                </div>
              </div>
              <h3 className="text-lg font-medium mb-2">Recent Passwords</h3>
              <p className="text-gray-600 max-w-md mx-auto mb-6">
                This feature will track your recently used passwords. 
                Feature coming soon!
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="security" className="mt-0">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <SecurityReport />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {isAddingPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <PasswordForm
              passwordId={editingPassword?.id}
              defaultValues={
                editingPassword
                  ? {
                      website: editingPassword.website,
                      url: editingPassword.url || "",
                      username: editingPassword.username,
                      password: editingPassword.password,
                      notes: editingPassword.notes || "",
                    }
                  : undefined
              }
              onSave={handleSavePassword}
              onCancel={handleCancelForm}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmDeletePassword}
        title="Delete Password"
        description="Are you sure you want to delete this password? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
