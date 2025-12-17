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
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>; // ✅ NUEVO
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const STORAGE_KEY = "registro_horas_user";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"; // ✅ Cambiado a 8080

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshPromise, setRefreshPromise] = useState<Promise<string | null> | null>(null); // ✅ NUEVO

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
    // ✅ Evitar múltiples refreshes simultáneos
    if (refreshPromise) {
      return refreshPromise;
    }

    const promise = (async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        logout();
        return null;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
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
      } finally {
        setRefreshPromise(null); // ✅ Limpiar promise
      }
    })();

    setRefreshPromise(promise);
    return promise;
  };

  // ✅ NUEVO: Fetch con auto-refresh
  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let token = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!token) {
      throw new Error('No token available');
    }

    // Primera petición con el token actual
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    // Si es 401, intentar refrescar el token y reintentar
    if (response.status === 401) {
      console.log('🔄 Token expirado, refrescando...');
      
      const newToken = await refreshAccessToken();
      
      if (!newToken) {
        throw new Error('Failed to refresh token');
      }

      // Reintentar la petición con el nuevo token
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${newToken}`,
        },
      });
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      refreshAccessToken,
      fetchWithAuth // ✅ NUEVO
    }}>
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