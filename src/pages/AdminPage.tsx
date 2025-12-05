import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import UserList from "../components/UserList";
import type { AdminUser } from "../components/UserList";
import AdminHoursViewer from "../components/AdminHoursViewer";
import UserDataEditor from "../components/UserDataEditor";
import AdminDocumentsManager from "../components/AdminDocumentsManager";
import AdminCalendarViewer from "../components/AdminCalendarViewer";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type Tab = "data" | "hours" | "documents" | "calendar";

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

  // Tab seleccionado
  const [selectedTab, setSelectedTab] = useState<Tab>("data");

  // Cargar usuarios
  useEffect(() => {
    if (!user?.token) return;
    setLoadingUsers(true);
    setErrorMsg(null);
    fetch(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Error");
        return res.json();
      })
      .then((d) => setUsers(d.users || []))
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoadingUsers(false));
  }, [user?.token]);

  const handleToggleActive = async (u: AdminUser) => {
    if (!user?.token) return;
    const end = u.isActive ? "deactivate" : "activate";
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/users/${u.id}/${end}`,
        { method: "PATCH", headers: { Authorization: `Bearer ${user.token}` } }
      );
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
      setSelectedUser((p) => (p?.id === u.id ? { ...p, isActive: !u.isActive } : p));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (!user?.token) return;
    if (!window.confirm(`¿Eliminar a ${u.fullName}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${u.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((p) => p.filter((x) => x.id !== u.id));
      if (selectedUser?.id === u.id) setSelectedUser(null);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateUser = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user?.token) return;
    if (!newUsername.trim()) {
      setCreateErrorMsg("Nombre obligatorio");
      return;
    }
    setCreatingUser(true);
    const ts = Date.now();
    const body = {
      username: `user${ts}`,
      fullName: newUsername.trim(),
      password: `temp${ts}`,
      role: "worker",
      vacationDaysPerYear: 23,
    };
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { user: created } = await res.json();
      setUsers((p) => [...p, created]);
      setSelectedUser(created);
      setNewUsername("");
      setSelectedTab("data");
    } catch (e: any) {
      setCreateErrorMsg(e.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleUserDataUpdated = (updated: AdminUser) => {
    setUsers((p) => p.map((u) => (u.id === updated.id ? updated : u)));
    setSelectedUser(updated);
  };

  /* ---------- UI ---------- */
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%" }}>
      {/* Panel izquierdo (igual que antes) */}
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
        <div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            Panel de administración
          </div>
          {user && (
            <div style={{ fontSize: "0.8rem", color: "#4b5563" }}>
              Sesión iniciada como <strong>{user.username}</strong>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
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
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Nombre completo"
              style={{
                width: "100%",
                padding: "0.4rem",
                borderRadius: "0.25rem",
                border: "1px solid #d1d5db",
                fontSize: "0.85rem",
              }}
            />
            {createErrorMsg && (
              <div
                style={{
                  marginTop: "0.5rem",
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
                marginTop: "0.5rem",
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

        {/* Lista usuarios */}
        <div style={{ flexGrow: 1, overflowY: "auto" }}>
          <h2 style={{ marginBottom: "0.5rem" }}>Usuarios</h2>
          {loadingUsers && <p>Cargando...</p>}
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
      <div style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
        {selectedUser ? (
          <>
            {/* Pestañas */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1rem",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              {(["data", "hours", "documents", "calendar"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTab(t)}
                  style={{
                    padding: "0.5rem 1rem",
                    border: "none",
                    borderBottom:
                      selectedTab === t ? "2px solid #2563eb" : "none",
                    backgroundColor: "transparent",
                    color: selectedTab === t ? "#2563eb" : "#6b7280",
                    fontWeight: selectedTab === t ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  {t === "data" && "Datos del usuario"}
                  {t === "hours" && "Horas registradas"}
                  {t === "documents" && "Documentos"}
                  {t === "calendar" && "Calendario"}
                </button>
              ))}
            </div>

            {/* Contenido según tab */}
            {selectedTab === "data" && (
              <UserDataEditor user={selectedUser} onUserUpdated={handleUserDataUpdated} />
            )}
            {selectedTab === "hours" && <AdminHoursViewer user={selectedUser} />}
            {selectedTab === "documents" && (
              <AdminDocumentsManager user={selectedUser} token={user!.token} />
            )}
            {selectedTab === "calendar" && (
              <AdminCalendarViewer user={selectedUser} token={user!.token} />
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