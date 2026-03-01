"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  setAuthToken,
  type AuthStatus,
} from "@/lib/api-client";

interface AuthContextValue {
  status: AuthStatus | null;
  loading: boolean;
  setToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  removeToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: null,
  loading: true,
  setToken: async () => ({ success: false }),
  removeToken: async () => {},
});

const STORAGE_KEY = "artifacts-api-token";

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Gate is based entirely on localStorage — each browser has its own token.
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    if (savedToken) {
      setStatus({ has_token: true, source: "user" });
    } else {
      setStatus({ has_token: false, source: "none" });
    }
    setLoading(false);
  }, []);

  const handleSetToken = useCallback(
    async (token: string): Promise<{ success: boolean; error?: string }> => {
      try {
        // Validate the token with the backend (it won't store it)
        const result = await setAuthToken(token);
        if (result.success) {
          localStorage.setItem(STORAGE_KEY, token);
          setStatus({ has_token: true, source: "user" });
          return { success: true };
        }
        return { success: false, error: result.error || "Unknown error" };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Network error",
        };
      }
    },
    []
  );

  const handleRemoveToken = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus({ has_token: false, source: "none" });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        loading,
        setToken: handleSetToken,
        removeToken: handleRemoveToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
