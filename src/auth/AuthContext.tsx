import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export interface LoggedUser {
  id: string;
  username: string;
  fullName: string;
  role: "worker" | "admin";
  token: string;
}

interface AuthContextProps {
  user: LoggedUser | null;
  login: (user: LoggedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const STORAGE_KEY = "registro_horas_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar usuario del localStorage al iniciar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        console.log("🔐 Sesión restaurada desde localStorage:", parsed.username);
        setUser(parsed);
      }
    } catch (err) {
      console.error("Error restaurando sesión:", err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (loggedUser: LoggedUser) => {
    console.log("🔐 Login exitoso:", loggedUser.username);
    setUser(loggedUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
    } catch (err) {
      console.error("Error guardando sesión:", err);
    }
  };

  const logout = () => {
    console.log("🔐 Cerrando sesión");
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    
    // opcional: quitar el “último chat abierto”
    localStorage.removeItem(`peritoia:lastChat:${user?.id}`);
  };


  // Mostrar un loading mientras se carga la sesión
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6"
      }}>
        <div style={{ fontSize: "1.2rem", color: "#6b7280" }}>
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
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