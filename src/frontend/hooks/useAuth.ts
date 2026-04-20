import { useEffect, useState } from "react";

export interface AuthUser {
  username: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string) => Promise<boolean>;
  resetPassword: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`Auth check failed: ${response.status}`);
      }

      const json = (await response.json()) as { user: AuthUser | null };
      setUser(json.user);
      setError(null);
    } catch (authError) {
      setUser(null);
      setError(authError instanceof Error ? authError.message : "Unknown auth error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const submit = async (path: string, username: string, password: string) => {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? `Request failed: ${response.status}`);
      }

      const json = (await response.json()) as { user: AuthUser };
      setUser(json.user);
      setError(null);
      return true;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unknown auth error");
      return false;
    }
  };

  const login = async (username: string, password: string) => submit("/api/auth/login", username, password);
  const signup = async (username: string, password: string) => submit("/api/auth/signup", username, password);
  const resetPassword = async (username: string, password: string) =>
    submit("/api/auth/reset-password", username, password);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setUser(null);
  };

  return { user, loading, error, refresh, login, signup, resetPassword, logout };
}
