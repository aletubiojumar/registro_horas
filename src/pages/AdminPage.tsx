import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import UserList from "../components/UserList";
import type { AdminUser } from "../components/UserList";
import AdminHoursViewer from "../components/AdminHoursViewer";
import UserDataEditor from "../components/UserDataEditor";
import AdminDocumentsManager from "../components/AdminDocumentsManager";
import AdminCalendarViewer from "../components/AdminCalendarViewer";
import { applyTheme, readTheme } from "../theme";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

type Tab = "data" | "hours" | "documents" | "calendar";

/* ---------- Iconos (igual que ProfilePage) ---------- */
const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M21 14.5A8.5 8.5 0 0 1 9.5 3a6.8 6.8 0 1 0 11.5 11.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconSun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <circle
      cx="12"
      cy="12"
      r="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const themeToggleStyle = (dark: boolean): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: "999px",
  border: "1px solid #d1d5db",
  backgroundColor: dark ? "#111827" : "#ffffff",
  color: dark ? "#f9fafb" : "#111827",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
});

const AdminPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Modo oscuro (igual que ProfilePage)
  const [darkMode, setDarkMode] = useState(() => readTheme());

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario de creación
  const [newEmail, setNewEmail] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [createErrorMsg, setCreateErrorMsg] = useState<string | null>(null);

  // Tab seleccionado
  const [selectedTab, setSelectedTab] = useState<Tab>("data");

  // Colores dependientes de darkMode (para que AdminPage cambie también)
  const colors = {
    pageBg: darkMode ? "#0b1220" : "#ffffff",
    rightBg: darkMode ? "#0b1220" : "#ffffff",
    leftBg: darkMode ? "#0f172a" : "#f9fafb",
    border: darkMode ? "#334155" : "#e5e7eb",
    text: darkMode ? "#e5e7eb" : "#111827",
    muted: darkMode ? "#94a3b8" : "#4b5563",
    cardBg: darkMode ? "#0b1220" : "#ffffff",
    inputBg: darkMode ? "#111827" : "#ffffff",
    inputBorder: darkMode ? "#334155" : "#d1d5db",
    dangerBg: darkMode ? "#3f1d1d" : "#fee2e2",
    dangerText: darkMode ? "#fecaca" : "#b91c1c",
    primary: "#2563eb",
  };

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
      const res = await fetch(`${API_BASE_URL}/admin/users/${u.id}/${end}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers((p) =>
        p.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x))
      );
      setSelectedUser((p) =>
        p?.id === u.id ? { ...p, isActive: !u.isActive } : p
      );
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
    if (!newEmail.trim()) {
      setCreateErrorMsg("Email obligatorio");
      return;
    }

    const emailInput = newEmail.trim();
    if (!emailInput) {
      setCreateErrorMsg("Email obligatorio");
      return;
    }

    setCreatingUser(true);
    setCreateErrorMsg(null);

    const ts = Date.now();
    const body = {
      email: `user${ts}@jumaringenieria.es`,
      fullName: newEmail.trim(),
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
      setNewEmail("");
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

  const handleToggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  };

  /* ---------- UI ---------- */
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        backgroundColor: colors.pageBg,
        color: colors.text,
      }}
    >
      {/* Toggle modo oscuro: fijo arriba-izquierda, luna/sol, sin texto */}
      <button
        type="button"
        onClick={handleToggleTheme}
        aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={darkMode ? "Modo claro" : "Modo oscuro"}
        style={{
          ...themeToggleStyle(darkMode),
          position: "fixed",
          bottom: 16,
          left: 16,
          zIndex: 9999,
        }}
      >
        {darkMode ? <IconSun /> : <IconMoon />}
      </button>


      {/* Panel izquierdo */}
      <div
        style={{
          width: "360px",
          borderRight: `1px solid ${colors.border}`,
          padding: "1rem",
          backgroundColor: colors.leftBg,
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
            <div style={{ fontSize: "0.8rem", color: colors.muted }}>
              Sesión iniciada como <strong>{user.email}</strong>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              marginTop: "0.25rem",
              padding: "0.25rem 0.6rem",
              borderRadius: "0.35rem",
              border: `1px solid ${colors.inputBorder}`,
              backgroundColor: colors.cardBg,
              color: colors.text,
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
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Nombre completo"
              style={{
                width: "100%",
                padding: "0.4rem",
                borderRadius: "0.25rem",
                border: `1px solid ${colors.inputBorder}`,
                backgroundColor: colors.inputBg,
                color: colors.text,
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
            {createErrorMsg && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.3rem",
                  borderRadius: "0.25rem",
                  backgroundColor: colors.dangerBg,
                  color: colors.dangerText,
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
                backgroundColor: colors.primary,
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
            <p style={{ color: colors.dangerText, fontSize: "0.8rem" }}>
              {errorMsg}
            </p>
          )}
          {!loadingUsers && !errorMsg && (
            <UserList
              users={users}
              selectedUser={selectedUser}
              onSelect={setSelectedUser}
              onToggleActive={handleToggleActive}
              onDeleteUser={handleDeleteUser}
              theme={{
                darkMode,
                border: colors.border,
                text: colors.text,
                muted: colors.muted,
                cardBg: colors.cardBg,
                primary: colors.primary,
                dangerBg: colors.dangerBg,
                dangerText: colors.dangerText,
              }}
            />
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div
        style={{
          flex: 1,
          padding: "1rem",
          overflowY: "auto",
          backgroundColor: colors.rightBg,
        }}
      >
        {selectedUser ? (
          <>
            {/* Pestañas */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1rem",
                borderBottom: `1px solid ${colors.border}`,
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
                      selectedTab === t
                        ? `2px solid ${colors.primary}`
                        : "2px solid transparent",
                    backgroundColor: "transparent",
                    color: selectedTab === t ? colors.primary : colors.muted,
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
              <UserDataEditor
                user={selectedUser}
                onUserUpdated={handleUserDataUpdated}
              />
            )}
            {selectedTab === "hours" && (
              <AdminHoursViewer user={selectedUser} theme={colors} />
            )}
            {selectedTab === "documents" && (
              <AdminDocumentsManager user={selectedUser} token={user!.token} theme={colors} />
            )}
            {selectedTab === "calendar" && (
              <AdminCalendarViewer user={selectedUser} token={user!.token} theme={colors} />
            )}
          </>
        ) : (
          <p style={{ color: colors.muted }}>
            Selecciona un usuario en la lista de la izquierda.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
