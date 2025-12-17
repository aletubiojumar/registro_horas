import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyTheme, readTheme } from "../theme";

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL ?? "/api";

type Profile = {
  fullName: string;
  username: string;
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

const ProfilePage: React.FC = () => {
  const { user, logout, fetchWithAuth } = useAuth();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => readTheme());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!user) return;

      try {
        const r = await fetchWithAuth(`${API_BASE_URL}/profile`, {
          method: "GET",
        });

        if (r.status === 401) {
          // Token inválido incluso tras refresh -> cerrar sesión
          logout();
          navigate("/login", { replace: true });
          return;
        }

        if (!r.ok) {
          throw new Error(`Error al cargar perfil (${r.status})`);
        }

        const data = (await r.json()) as Profile;
        if (!cancelled) setProfile(data);
      } catch (err) {
        console.error("ProfilePage error:", err);
        if (!cancelled) {
          alert("Error al cargar perfil");
          setProfile(null);
        }
      }
    };

    void loadProfile();

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

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h2>Área personal</h2>

      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <img
          src={profile.avatarDataUrl || "/avatar-placeholder.png"}
          alt="Avatar"
          style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover" }}
        />
        <br />
        <label
          style={{
            marginTop: "0.5rem",
            display: "inline-block",
            padding: "0.4rem 0.8rem",
            fontSize: "0.8rem",
            border: "1px solid #d1d5db",
            borderRadius: "0.35rem",
            backgroundColor: "#fff",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? "Subiendo…" : "Cambiar foto"}
          <input type="file" accept="image/*" onChange={handleUploadAvatar} hidden disabled={uploading} />
        </label>
      </div>

      {/* Datos de empresa */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1.5rem" }}>
        <h3>Datos de la empresa</h3>
        {row("Centro de trabajo", profile.workCenter)}
        {row("CIF", profile.companyCif)}
        {row("Código CCC", profile.companyCcc)}
      </section>

      {/* Datos personales */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1.5rem" }}>
        <h3>Datos personales</h3>
        {row("Nombre de usuario", profile.username)}
        {row("Nombre completo", profile.fullName)}
        {row("Apellidos", profile.workerLastName)}
        {row("Nombre", profile.workerFirstName)}
        {row("NIF", profile.workerNif)}
        {row("Nº Seguridad Social", profile.workerSsNumber)}
        {row("Días de vacaciones/año", profile.vacationDaysPerYear)}
      </section>

      {/* Botones */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            const next = !darkMode;
            setDarkMode(next);
            applyTheme(next);
          }}
          style={btnStyle(darkMode ? "#334155" : "#111827", "#fff")}
        >
          {darkMode ? "Modo claro" : "Modo oscuro"}
        </button>

        <button onClick={() => navigate("/horas")} style={btnStyle("#dc2626", "#fff")}>
          Ir a Registro Horario
        </button>
        <button onClick={() => navigate("/calendario")} style={btnStyle("#7c3aed", "#fff")}>
          Mi Calendario
        </button>
        <button onClick={() => navigate("/mis-documentos")} style={btnStyle("#16a34a", "#fff")}>
          Mis Documentos
        </button>
        <button onClick={() => navigate("/perito-ia")} style={btnStyle("#a78bfa", "#fff")}>
          PeritoIA - Asistente
        </button>
        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          style={btnStyle("#2563eb", "#fff")}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  padding: "0.55rem 1.1rem",
  border: "none",
  borderRadius: "0.35rem",
  backgroundColor: bg,
  color,
  fontSize: "0.85rem",
  cursor: "pointer",
});

export default ProfilePage;
