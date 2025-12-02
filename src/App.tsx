import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import LoginPage from "./pages/LoginPage";
import HoursPage from "./pages/HoursPage";
import AdminPage from "./pages/AdminPage";
import ProfilePage from "./pages/ProfilePage";
import CalendarPage from "./pages/CalendarPage";
import DocumentsPage from "./pages/DocumentsPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user } = useAuth();
  console.log("ProtectedRoute", { user, adminOnly });

  if (!user) {
    console.log("→ sin usuario → login");
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    console.log("→ no es admin → /horas");
    return <Navigate to="/horas" replace />;
  }

  console.log("→ todo ok → renderiza hijo");
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

        {/* PERFIL */}
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* CALENDARIO */}
        <Route
          path="/calendario"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />

        {/* DOCUMENTOS */}
        <Route 
          path="/mis-documentos"
          element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>} />

        {/* Ruta raíz -> redirige a login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Cualquier otra ruta -> login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
