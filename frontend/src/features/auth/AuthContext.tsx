import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../../api/auth";

interface AuthState {
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const user = await authApi.me();
      setUsername(user.username);
    } catch {
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const onUnauthorized = () => setUsername(null);
    window.addEventListener("api:unauthorized", onUnauthorized);
    return () => window.removeEventListener("api:unauthorized", onUnauthorized);
  }, []);

  async function login(u: string, password: string) {
    const user = await authApi.login(u, password);
    setUsername(user.username);
  }

  async function logout() {
    await authApi.logout();
    setUsername(null);
  }

  return <AuthContext.Provider value={{ username, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
