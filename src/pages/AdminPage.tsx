import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import UserList from "../components/UserList";
import type { AdminUser } from "../components/UserList";
import AdminHoursViewer from "../components/AdminHoursViewer";
import UserDataEditor from "../components/UserDataEditor";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const AdminPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario de creación
  const [newUsername, setNewUsername] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  // Tab seleccionado: 'data' o 'hours'
  const [selectedTab, setSelectedTab] = useState<"data" | "hours">("data");

  // Cargar usuarios al entrar
  useEffect(() => {
    if (!user?.token) return;

    setLoadingUsers(true);
    setErrorMsg(null);

    fetch(`${API_BASE_URL}/admin/users`, {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || "Error al cargar usuarios.");
        }
        return res.json();
      })
      .then((data) => {
        setUsers(data.users || []);
      })
      .catch((err) => {
        console.error("Error cargando usuarios admin:", err);
        setErrorMsg(err.message || "Error al cargar usuarios.");
      })
      .finally(() => setLoadingUsers(false));
  }, [user?.token]);

  const handleToggleActive = async (u: AdminUser) => {
    if (!user?.token) return;

    const endpoint = u.isActive ? "deactivate" : "activate";

    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/users/${u.id}/${endpoint}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Error al cambiar el estado del usuario.");
        return;
      }

      setUsers((prev) =>
        prev.map((usr) =>
          usr.id === u.id ? { ...usr, isActive: !u.isActive } : usr
        )
      );
      setSelectedUser((prev) =>
        prev && prev.id === u.id ? { ...prev, isActive: !u.isActive } : prev
      );
    } catch (err) {
      console.error("Error toggle activo:", err);
      alert("Error de conexión al cambiar estado del usuario.");
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (!user?.token) return;
    if (!window.confirm(`¿Seguro que quieres eliminar al usuario "${u.fullName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${u.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        alert(err?.error || "Error al eliminar el usuario.");
        return;
      }

      setUsers((prev) => prev.filter((usr) => usr.id !== u.id));
      if (selectedUser?.id === u.id) {
        setSelectedUser(null);
      }
    } catch (err) {
      console.error("Error eliminando usuario:", err);
      alert("Error de conexión al eliminar el usuario.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.token) return;

    if (!newUsername.trim()) {
      setCreateErrorMsg("El nombre del usuario es obligatorio.");
      return;
    }

    // Generar username y contraseña automáticos
    const timestamp = Date.now();
    const autoUsername = `usuario${timestamp}`;
    const autoPassword = `temp${timestamp}`;

    setCreatingUser(true);
    setCreateErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: autoUsername,
          fullName: newUsername.trim(),
          password: autoPassword,
          role: "worker",
          vacationDaysPerYear: 23,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setCreateErrorMsg(err?.error || "Error al crear el usuario.");
        setCreatingUser(false);
        return;
      }

      const data = await res.json();
      const created: AdminUser = data.user;

      setUsers((prev) => [...prev, created]);
      
      // Seleccionar automáticamente el usuario creado y mostrar el tab de datos
      setSelectedUser(created);
      setSelectedTab("data");
      
      // Limpiar el campo
      setNewUsername("");
      setCreateErrorMsg(null);
      
    } catch (err) {
      console.error("Error creando usuario:", err);
      setCreateErrorMsg("Error de conexión al crear el usuario.");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleUserDataUpdated = (updatedUser: AdminUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    setSelectedUser(updatedUser);
  };

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Panel izquierdo */}
      <div
        style={{
          width: "360px",
          borderRight: "1px solid #e5e7eb",
          padding: "1rem",
          backgroundColor: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          overflowY: "auto",
        }}
      >
        {/* Cabecera con info admin y logout */}
        <div
          style={{
            marginBottom: "0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Panel de administración
          </div>
          {user && (
            <div style={{ fontSize: "0.8rem", color: "#4b5563" }}>
              Sesión iniciada como <strong>{user.username}</strong>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              alignSelf: "flex-start",
              marginTop: "0.25rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "0.35rem",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>

        {/* Crear usuario */}
        <div>
          <h2 style={{ marginBottom: "0.5rem" }}>Crear usuario</h2>
          <form onSubmit={handleCreateUser} style={{ fontSize: "0.8rem" }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <label>
                Nombre del usuario:
                <br />
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  style={{
                    width: "100%",
                    padding: "0.4rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                  }}
                />
              </label>
            </div>
            {createErrorMsg && (
              <div
                style={{
                  marginBottom: "0.5rem",
                  padding: "0.3rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  fontSize: "0.75rem",
                }}
              >
                {createErrorMsg}
              </div>
            )}
            <button
              type="submit"
              disabled={creatingUser}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.35rem",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: creatingUser ? "not-allowed" : "pointer",
                opacity: creatingUser ? 0.6 : 1,
              }}
            >
              {creatingUser ? "Creando..." : "➕ Crear usuario"}
            </button>
          </form>
        </div>

        {/* Lista de usuarios */}
        <div style={{ flexGrow: 1, overflowY: "auto" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Usuarios</h2>
          {loadingUsers && <p>Cargando usuarios...</p>}
          {errorMsg && (
            <p style={{ color: "#b91c1c", fontSize: "0.8rem" }}>{errorMsg}</p>
          )}
          {!loadingUsers && !errorMsg && (
            <UserList
              users={users}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onToggleActive={handleToggleActive}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flexGrow: 1, padding: "1rem", overflowY: "auto" }}>
        {selectedUser ? (
          <>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1rem",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => setSelectedTab("data")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderBottom:
                    selectedTab === "data" ? "2px solid #2563eb" : "none",
                  backgroundColor: "transparent",
                  color: selectedTab === "data" ? "#2563eb" : "#6b7280",
                  fontWeight: selectedTab === "data" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Datos del usuario
              </button>
              <button
                onClick={() => setSelectedTab("hours")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  borderBottom:
                    selectedTab === "hours" ? "2px solid #2563eb" : "none",
                  backgroundColor: "transparent",
                  color: selectedTab === "hours" ? "#2563eb" : "#6b7280",
                  fontWeight: selectedTab === "hours" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Horas registradas
              </button>
            </div>

            {/* Contenido del tab */}
            {selectedTab === "data" && (
              <UserDataEditor
                user={selectedUser}
                onUserUpdated={handleUserDataUpdated}
              />
            )}
            {selectedTab === "hours" && (
              <AdminHoursViewer user={selectedUser} />
            )}
          </>
        ) : (
          <p>Selecciona un usuario en la lista de la izquierda.</p>
        )}
      </div>
    </div>
  );
};

export default AdminPage;