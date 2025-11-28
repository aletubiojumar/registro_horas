import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type AuthUser = {
  id: number;
  username: string;
  fullName: string;
};

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

const AUTH_TOKEN_KEY = "authToken";

export const AuthProvider = ({ children }: Props) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }, []);

  // Restaurar sesión desde localStorage al cargar la app
  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    const restoreSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!res.ok) {
          logout();
          return;
        }

        const data = (await res.json()) as AuthUser;
        setUser(data);
        setToken(storedToken);
      } catch (error) {
        console.error("Error restaurando sesión:", error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [logout]);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        const msg =
          errorBody?.message ?? "Error al iniciar sesión. Revisa tus credenciales.";
        alert(msg);
        return false;
      }

      const data = (await res.json()) as {
        token: string;
        user: AuthUser;
      };

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(AUTH_TOKEN_KEY, data.token);

      return true;
    } catch (error) {
      console.error("Error en login:", error);
      alert("No se ha podido conectar con el servidor.");
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return ctx;
};
