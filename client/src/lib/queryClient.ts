import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function handleResponse(res: Response) {
  if (!res.ok) {
    console.warn(`API response not OK: ${res.status} ${res.statusText}`);
    try {
      // Clone the response before reading it
      const clonedRes = res.clone();
      const errorText = await clonedRes.text();
      console.warn('Error details:', errorText);
      // Return the original response to handle errors at the mutation level
      return res;
    } catch (e) {
      console.error('Failed to parse error response:', e);
      return res;
    }
  }
  return res;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const body = data ? JSON.stringify(data) : undefined;
    
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body,
      credentials: "include",
    });

    return await handleResponse(res);
  } catch (error) {
    console.error(`API request failed for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (!res.ok) {
        console.warn(`Query response not OK: ${res.status} ${res.statusText}`);
        if (res.status === 400) {
          // For 400 errors, we'll still attempt to parse the response
          try {
            return await res.json();
          } catch (e) {
            console.error('Failed to parse 400 response:', e);
          }
        }
        // For other error types, return null or a default value
        return null;
      }
      
      return await res.json();
    } catch (error) {
      console.error(`Query failed for ${queryKey[0]}:`, error);
      return null;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
