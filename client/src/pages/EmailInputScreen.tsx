import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

interface EmailInputScreenProps {
  onNext: (isRegistered: boolean) => void;
}

export default function EmailInputScreen({ onNext }: EmailInputScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { setEmail } = useAuth();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });
  
  const checkUserMutation = useMutation({
    mutationFn: async (email: string) => {
      try {
        const res = await apiRequest("POST", "/api/auth/check-user", { email });
        
        if (!res.ok) {
          console.warn(`Check user request failed with status: ${res.status}`);
          // For non-200 responses, we'll create a default response
          return { exists: false, error: true };
        }
        
        return await res.json();
      } catch (error) {
        console.error("Error in checkUserMutation:", error);
        // Return a sensible default to prevent app from crashing
        return { exists: false, error: true };
      }
    },
    onSuccess: (data) => {
      if (data.error) {
        toast({
          title: "Warning",
          description: "Couldn't verify your account status. Proceeding as a new user.",
          variant: "default",
        });
      }
      
      setEmail(form.getValues().email);
      onNext(data.exists || false);
    },
    onError: (error) => {
      toast({
        title: "Notice",
        description: "Continuing as a new user",
        variant: "default", 
      });
      console.error("Error checking user:", error);
      
      // Still proceed with the flow even on error
      setEmail(form.getValues().email);
      onNext(false);
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });
  
  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    checkUserMutation.mutate(values.email);
  }
  
  return (
    <Card className="bg-white rounded-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.1)]">
      <CardContent className="pt-6">
        <h2 className="text-xl font-semibold mb-5">Sign in or create account</h2>
        <p className="text-[#636366] text-sm mb-6">
          Enter your email to get started with secure passkey authentication.
        </p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-[#48484A]">Email address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="you@example.com" 
                      className="w-full py-3 px-4 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 px-4 rounded-[22px] font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-[#007AFF]"
              disabled={isLoading}
            >
              {isLoading ? "Checking..." : "Continue"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
