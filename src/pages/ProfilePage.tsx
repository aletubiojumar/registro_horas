import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyTheme, readTheme } from "../theme";

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL ?? "/api";

type Profile = {
  fullName: string;
  email: string;
  vacationDaysPerYear: number;
  workCenter: string;
  companyCif: string;
  companyCcc: string;
  workerLastName: string;
  workerFirstName: string;
  workerNif: string;
  workerSsNumber: string;
  avatarDataUrl?: string | null;
};

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
    <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path
      d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconHamburger = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 6h16M4 12h16M4 18h16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M18 6 6 18M6 6l12 12"
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
  border: dark ? "1px solid #334155" : "1px solid #d1d5db",
  backgroundColor: dark ? "#111827" : "#ffffff",
  color: dark ? "#f9fafb" : "#111827",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
});

const iconButtonStyle = (dark: boolean): React.CSSProperties => ({
  width: 40,
  height: 40,
  borderRadius: "999px",
  border: dark ? "1px solid #334155" : "1px solid #d1d5db",
  backgroundColor: dark ? "#111827" : "#ffffff",
  color: dark ? "#f9fafb" : "#111827",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
});

const ProfilePage: React.FC = () => {
  const { user, logout, fetchWithAuth } = useAuth();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => readTheme());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const palette = useMemo(() => {
    // Botones del menú: mismo color, acorde a la paleta
    const primary = darkMode ? "#3b82f6" : "#2563eb";
    const primaryHover = darkMode ? "#60a5fa" : "#1d4ed8";
    const surface = darkMode ? "#0b1220" : "#ffffff";
    const surface2 = darkMode ? "#111827" : "#ffffff";
    const border = darkMode ? "#334155" : "#e5e7eb";
    const text = darkMode ? "#e5e7eb" : "#111827";
    const muted = darkMode ? "#94a3b8" : "#6b7280";
    const overlay = "rgba(0,0,0,0.35)";
    return { primary, primaryHover, surface, surface2, border, text, muted, overlay };
  }, [darkMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!user) return;

      try {
        const r = await fetchWithAuth(`${API_BASE_URL}/profile`, {
          method: "GET",
        });

        if (r.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }

        if (!r.ok) {
          alert("No se pudo cargar el perfil");
          return;
        }

        const data = (await r.json()) as Profile;
        if (!cancelled) setProfile(data);
      } catch (e) {
        console.error(e);
        alert("Error cargando perfil");
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user, fetchWithAuth, logout, navigate]);

  const handleUploadAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = async () => {
      const dataUrl = reader.result as string;

      try {
        setUploading(true);

        const res = await fetchWithAuth(`${API_BASE_URL}/profile/avatar`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ avatarDataUrl: dataUrl }),
        });

        if (res.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }

        if (!res.ok) {
          alert("Error al subir imagen");
          return;
        }

        setProfile((p) => (p ? { ...p, avatarDataUrl: dataUrl } : p));
      } catch (err) {
        console.error("Error subiendo avatar:", err);
        alert("Error al subir imagen");
      } finally {
        setUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  if (!user) return <p>Cargando…</p>;
  if (!profile) return <p>Cargando…</p>;

  const row = (label: string, value: string | number | null | undefined) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.35rem 0" }}>
      <strong>{label}</strong>
      <span>{value ? String(value) : "-"}</span>
    </div>
  );

  const menuItems: Array<{ label: string; onClick: () => void }> = [
    { label: "Ir a Registro Horario", onClick: () => navigate("/horas") },
    { label: "Mi Calendario", onClick: () => navigate("/calendario") },
    { label: "Mis Documentos", onClick: () => navigate("/mis-documentos") },
    { label: "PeritoIA - Asistente", onClick: () => navigate("/perito-ia") },
    {
      label: "Cerrar sesión",
      onClick: () => {
        logout();
        navigate("/login", { replace: true });
      },
    },
  ];

  const menuButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.85rem",
    borderRadius: "0.5rem",
    border: `1px solid ${palette.border}`,
    backgroundColor: palette.primary,
    color: "#ffffff",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <>
      {/* Overlay click-outside del menú */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: palette.overlay,
            zIndex: 9998,
          }}
          aria-hidden="true"
        />
      )}

      {/* Botón modo noche (abajo izquierda) */}
      <button
        type="button"
        onClick={() => {
          const next = !darkMode;
          setDarkMode(next);
          applyTheme(next);
        }}
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

      {/* Botón hamburguesa (arriba derecha) */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        title={menuOpen ? "Cerrar menú" : "Menú"}
        style={{
          ...iconButtonStyle(darkMode),
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 9999,
        }}
      >
        {menuOpen ? <IconClose /> : <IconHamburger />}
      </button>

      {/* Panel del menú */}
      {menuOpen && (
        <div
          role="menu"
          aria-label="Menú"
          style={{
            position: "fixed",
            top: 64,
            left: 16,
            width: 260,
            padding: "0.75rem",
            borderRadius: "0.75rem",
            backgroundColor: palette.surface2,
            border: `1px solid ${palette.border}`,
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: "0.85rem", color: palette.muted, marginBottom: "0.6rem" }}>
            Navegación
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {menuItems.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  it.onClick();
                }}
                style={menuButtonStyle}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = palette.primaryHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = palette.primary;
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: 720,
          margin: "2rem auto",
          padding: "0 1rem",
          color: palette.text,
        }}
      >
        <h2>Área personal</h2>

        {/* Avatar */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={profile.avatarDataUrl || "/avatar-placeholder.png"}
            alt="Avatar"
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              objectFit: "cover",
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.surface,
            }}
          />
          <br />
          <label
            style={{
              display: "inline-block",
              marginTop: "0.75rem",
              padding: "0.5rem 0.9rem",
              borderRadius: "0.5rem",
              border: `1px solid ${palette.border}`,
              backgroundColor: palette.surface,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Subiendo..." : "Cambiar foto"}
            <input type="file" accept="image/*" onChange={handleUploadAvatar} disabled={uploading} hidden />
          </label>
        </div>

        {/* Datos empresa */}
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.5rem",
            backgroundColor: palette.surface,
          }}
        >
          <h3>Datos de la empresa</h3>
          {row("Centro de trabajo", profile.workCenter)}
          {row("CIF", profile.companyCif)}
          {row("Código CCC", profile.companyCcc)}
        </section>

        {/* Datos personales */}
        <section
          style={{
            border: `1px solid ${palette.border}`,
            borderRadius: "0.75rem",
            padding: "1rem",
            marginBottom: "1.5rem",
            backgroundColor: palette.surface,
          }}
        >
          <h3>Datos personales</h3>
          {row("Nombre completo", profile.fullName)}
          {row("Apellidos", profile.workerLastName)}
          {row("Nombre", profile.workerFirstName)}
          {row("NIF", profile.workerNif)}
          {row("Nº Seguridad Social", profile.workerSsNumber)}
          {row("Días de vacaciones/año", profile.vacationDaysPerYear)}
        </section>

        {/* (Quitados) Botones de colores de abajo: ahora están en el menú */}
        <div style={{ height: 24 }} />
      </div>
    </>
  );
};

export default ProfilePage;
