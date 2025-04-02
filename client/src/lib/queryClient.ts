import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function handleResponse(res: Response) {
  if (!res.ok) {
    console.warn(`API response not OK: ${res.status} ${res.statusText}`);
    try {
      // Clone the response before reading it to avoid "body already read" errors
      const clonedRes = res.clone();
      const errorText = await clonedRes.text();
      console.warn('Error details:', errorText);
      
      // Try to parse the error response as JSON
      try {
        const errorJson = JSON.parse(errorText);
        const errorMessage = errorJson.message || 'Unknown error occurred';
        throw new Error(errorMessage);
      } catch (jsonError) {
        // If parsing fails, use the status text
        throw new Error(res.statusText || 'Request failed');
      }
    } catch (e) {
      // If any step fails, throw the error
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('Failed to process response');
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
    console.log(`Making ${method} request to ${url}`);
    const body = data ? JSON.stringify(data) : undefined;
    
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body,
      credentials: "include",
    });

    console.log(`${method} ${url} response status:`, res.status);
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
      console.log(`Making query request to ${queryKey[0]}`);
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      console.log(`Query ${queryKey[0]} response status:`, res.status);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log("Unauthorized access, returning null as configured");
        return null;
      }

      if (!res.ok) {
        console.warn(`Query response not OK: ${res.status} ${res.statusText}`);
        
        // Try to read and log the error response
        try {
          const clonedRes = res.clone();
          const errorText = await clonedRes.text();
          console.warn('Error response:', errorText);
          
          // Try to parse it as JSON
          try {
            const errorJson = JSON.parse(errorText);
            if (unauthorizedBehavior === "throw" && res.status === 401) {
              throw new Error(errorJson.message || "Unauthorized");
            }
          } catch (jsonError) {
            // Parsing error, ignore
          }
        } catch (readError) {
          console.error("Failed to read error response:", readError);
        }
        
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
      
      try {
        const data = await res.json();
        return data;
      } catch (e) {
        console.error(`Failed to parse JSON response for ${queryKey[0]}:`, e);
        return null;
      }
    } catch (error) {
      console.error(`Query failed for ${queryKey[0]}:`, error);
      if (unauthorizedBehavior === "throw") {
        throw error;
      }
      return null;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }), // Default throws on 401
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes instead of Infinity
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
