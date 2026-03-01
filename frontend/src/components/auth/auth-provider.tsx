"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  getAuthStatus,
  setAuthToken,
  clearAuthToken,
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

  const checkStatus = useCallback(async () => {
    try {
      const s = await getAuthStatus();
      setStatus(s);

      // If backend has no token but we have one in localStorage, auto-restore it
      if (!s.has_token) {
        const savedToken = localStorage.getItem(STORAGE_KEY);
        if (savedToken) {
          const result = await setAuthToken(savedToken);
          if (result.success) {
            setStatus({ has_token: true, source: "user" });
          } else {
            // Token is stale, remove it
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      // Backend unreachable — show the gate anyway
      setStatus({ has_token: false, source: "none" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleSetToken = useCallback(
    async (token: string): Promise<{ success: boolean; error?: string }> => {
      try {
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
    try {
      const s = await clearAuthToken();
      setStatus(s);
    } catch {
      setStatus({ has_token: false, source: "none" });
    }
    localStorage.removeItem(STORAGE_KEY);
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
