import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";


type User = {
  username: string;
};

type LoginErrorCode = "USER_NOT_FOUND" | "BAD_CREDENTIALS";

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginErrorCode | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (
    username: string,
    password: string
  ): Promise<LoginErrorCode | null> => {
    // 🔴 LÓGICA FALSA por ahora, para probar el front
    // Luego aquí llamarás a tu API de login en el backend.

    if (username !== "alejandro") {
      return "USER_NOT_FOUND";
    }

    if (password !== "1234") {
      return "BAD_CREDENTIALS";
    }

    setUser({ username });
    return null;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
