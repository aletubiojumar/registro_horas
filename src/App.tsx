import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/LoginPage";
import HoursPage from "./pages/HoursPage";
import AdminPage from "./pages/AdminPage";

interface ProtectedRouteProps {
  children: React.ReactElement;
  adminOnly?: boolean;
}

function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user } = useAuth();

  // No hay usuario -> al login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Ruta solo admin y el usuario no lo es -> a horas
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/horas" replace />;
  }

  return children;
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* TRABAJADOR */}
        <Route
          path="/horas"
          element={
            <ProtectedRoute>
              <HoursPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta raíz -> redirige a login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Cualquier otra ruta -> login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
