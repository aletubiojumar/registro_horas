import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface LoggedUser {
  id: string;
  username: string;
  fullName: string;
  role: "worker" | "admin";
  token: string; // Access token
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface AuthContextProps {
  user: LoggedUser | null;
  loading: boolean;
  login: (tokens: Tokens, userData: Omit<LoggedUser, 'token'>) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const STORAGE_KEY = "registro_horas_user";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar usuario y tokens del localStorage
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      
      if (storedUser && accessToken) {
        const parsed = JSON.parse(storedUser);
        setUser({ ...parsed, token: accessToken });
      }
    } catch (err) {
      console.error("Error restaurando sesión:", err);
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (tokens: Tokens, userData: Omit<LoggedUser, 'token'>) => {
    const loggedUser: LoggedUser = {
      ...userData,
      token: tokens.accessToken
    };
    setUser(loggedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(`peritoia:lastChat:${user?.id}`);
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      logout();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) throw new Error('Refresh failed');

      const { accessToken } = await res.json();
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      
      setUser(prev => prev ? { ...prev, token: accessToken } : null);
      return accessToken;
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      return null;
    }
  };

    // Dentro del provider, antes del return:
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextProps {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}