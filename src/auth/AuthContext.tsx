import React, { createContext, useContext, useState } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);

  const login = (loggedUser: LoggedUser) => {
    setUser(loggedUser);
  };

  const logout = () => {
    setUser(null);
  };

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
