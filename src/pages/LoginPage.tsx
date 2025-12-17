import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyTheme, readTheme } from "../theme";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

/* ---------- Iconos (igual que Profile/Admin) ---------- */
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

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [darkMode, setDarkMode] = useState(() => readTheme());

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estilos dependientes del tema
  const colors = {
    pageBg: darkMode ? "#0b1220" : "#f3f4f6",
    cardBg: darkMode ? "#0f172a" : "#ffffff",
    border: darkMode ? "#334155" : "#e5e7eb",
    text: darkMode ? "#e5e7eb" : "#111827",
    muted: darkMode ? "#94a3b8" : "#6b7280",
    label: darkMode ? "#cbd5e1" : "#374151",
    inputBg: darkMode ? "#111827" : "#ffffff",
    inputBorder: darkMode ? "#334155" : "#d1d5db",
    btnBorder: darkMode ? "#334155" : "#d1d5db",
    btnBg: darkMode ? "#0b1220" : "#f9fafb",
    primary: "#2563eb",
    errorBg: darkMode ? "#3b0f18" : "#fee2e2",
    errorText: darkMode ? "#fecaca" : "#b91c1c",
    footer: darkMode ? "#94a3b8" : "#6b7280",
    footerHint: darkMode ? "#64748b" : "#9ca3af",
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageBg,
    padding: "1rem",
    color: colors.text,
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "400px",
    backgroundColor: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: "0.75rem",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
    padding: "1.75rem 1.5rem",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "0.25rem",
    color: colors.text,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    color: colors.muted,
    marginBottom: "1.25rem",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 500,
    color: colors.label,
    marginBottom: "0.25rem",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.4rem 0.5rem",
    borderRadius: "0.375rem",
    border: `1px solid ${colors.inputBorder}`,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: "0.85rem",
    outline: "none",
  };

  const checkboxRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.8rem",
    color: darkMode ? "#cbd5e1" : "#4b5563",
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    marginTop: "1rem",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    border: "none",
    backgroundColor: colors.primary,
    color: "#ffffff",
    fontSize: "0.9rem",
    fontWeight: 500,
    cursor: "pointer",
  };

  const errorStyle: React.CSSProperties = {
    marginTop: "0.75rem",
    padding: "0.5rem",
    borderRadius: "0.375rem",
    backgroundColor: colors.errorBg,
    color: colors.errorText,
    fontSize: "0.8rem",
    border: `1px solid ${colors.errorText}`,
  };

  const footerStyle: React.CSSProperties = {
    marginTop: "0.75rem",
    fontSize: "0.75rem",
    color: colors.footer,
  };

  // Si ya hay usuario logueado, redirigir
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/perfil", { replace: true });
    }
  }, [user, navigate]);

  // Cargar usuario recordado
  useEffect(() => {
    const remembered = localStorage.getItem("rememberedUser");
    if (remembered) {
      setUsername(remembered);
      setRememberUser(true);
    }
  }, []);

  const handleToggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    applyTheme(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username || !password) {
      setErrorMsg("Introduce usuario y contraseña.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          data?.error || "No se ha podido iniciar sesión. Revisa las credenciales.";
        setErrorMsg(message);
        setIsSubmitting(false);
        return;
      }

      const { accessToken, refreshToken, expiresIn, user: userData } = data;

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      login(
        { accessToken, refreshToken, expiresIn },
        {
          id: userData.id,
          username: userData.username,
          fullName: userData.fullName,
          role: userData.role,
        }
      );

      if (userData.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/perfil", { replace: true });
      }

      if (rememberUser) localStorage.setItem("rememberedUser", username);
      else localStorage.removeItem("rememberedUser");
    } catch (err) {
      console.error("Error en login:", err);
      setErrorMsg("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Toggle modo noche (abajo izquierda, no tapa texto) */}
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

      <div style={cardStyle}>
        <h1 style={titleStyle}>Acceso al registro de jornada</h1>
        <p style={subtitleStyle}>
          Introduce tus credenciales corporativas para acceder.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={labelStyle} htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              style={inputStyle}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label style={labelStyle} htmlFor="password">
              Contraseña
            </label>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                style={{ ...inputStyle, flexGrow: 1 }}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                style={{
                  padding: "0.4rem 0.6rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.375rem",
                  border: `1px solid ${colors.btnBorder}`,
                  backgroundColor: colors.btnBg,
                  color: colors.text,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "0.25rem",
              marginBottom: "0.25rem",
            }}
          >
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
              />
              Recordar usuario
            </label>
          </div>

          <button
            type="submit"
            style={{
              ...buttonStyle,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Accediendo..." : "Entrar"}
          </button>

          {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

          <div style={footerStyle}>
            <span style={{ color: colors.footerHint }}>
              Si no tienes usuario o tienes problemas de acceso, contacta con
              administración.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
