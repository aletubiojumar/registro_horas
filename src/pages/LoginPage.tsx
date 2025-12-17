import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyTheme, readTheme } from "../theme";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const MoonIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M21 13.2A8.5 8.5 0 0 1 10.8 3 7.5 7.5 0 1 0 21 13.2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const SunIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [darkMode, setDarkMode] = useState(() => readTheme());

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Aplicar tema al cargar y cuando cambie
  useEffect(() => {
    applyTheme(darkMode);
  }, [darkMode]);

  // Si ya hay usuario logueado, redirigir
  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") navigate("/admin", { replace: true });
    else navigate("/perfil", { replace: true });
  }, [user, navigate]);

  // Cargar usuario recordado
  useEffect(() => {
    const remembered = localStorage.getItem("rememberedUser");
    if (remembered) {
      setUsername(remembered);
      setRememberUser(true);
    }
  }, []);

  const styles = useMemo(() => {
    const bg = darkMode ? "#0b1220" : "#f3f4f6";
    const cardBg = darkMode ? "#0f172a" : "#ffffff";
    const border = darkMode ? "#1f2937" : "#e5e7eb";
    const text = darkMode ? "#e5e7eb" : "#111827";
    const muted = darkMode ? "#9ca3af" : "#6b7280";
    const inputBg = darkMode ? "#0b1220" : "#ffffff";
    const inputBorder = darkMode ? "#334155" : "#d1d5db";

    const containerStyle: CSSProperties = {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: bg,
      padding: "1rem",
      position: "relative",
    };

    const cardStyle: CSSProperties = {
      width: "100%",
      maxWidth: "420px",
      backgroundColor: cardBg,
      borderRadius: "0.9rem",
      boxShadow: darkMode
        ? "0 20px 50px rgba(0,0,0,0.35)"
        : "0 10px 25px rgba(0,0,0,0.08)",
      padding: "1.75rem 1.5rem",
      border: `1px solid ${border}`,
    };

    const titleStyle: CSSProperties = {
      fontSize: "1.25rem",
      fontWeight: 700,
      marginBottom: "0.25rem",
      color: text,
    };

    const subtitleStyle: CSSProperties = {
      fontSize: "0.85rem",
      color: muted,
      marginBottom: "1.25rem",
      lineHeight: 1.35,
    };

    const labelStyle: CSSProperties = {
      display: "block",
      fontSize: "0.8rem",
      fontWeight: 600,
      color: darkMode ? "#cbd5e1" : "#374151",
      marginBottom: "0.25rem",
    };

    const inputStyle: CSSProperties = {
      width: "100%",
      padding: "0.45rem 0.55rem",
      borderRadius: "0.45rem",
      border: `1px solid ${inputBorder}`,
      fontSize: "0.9rem",
      backgroundColor: inputBg,
      color: text,
      outline: "none",
    };

    const checkboxRowStyle: CSSProperties = {
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      fontSize: "0.8rem",
      color: darkMode ? "#cbd5e1" : "#4b5563",
    };

    const buttonStyle: CSSProperties = {
      width: "100%",
      marginTop: "1rem",
      padding: "0.55rem",
      borderRadius: "0.5rem",
      border: "none",
      backgroundColor: "#2563eb",
      color: "#ffffff",
      fontSize: "0.9rem",
      fontWeight: 600,
      cursor: "pointer",
    };

    const smallBtnStyle: CSSProperties = {
      padding: "0.45rem 0.7rem",
      fontSize: "0.8rem",
      borderRadius: "0.45rem",
      border: `1px solid ${inputBorder}`,
      backgroundColor: darkMode ? "#111827" : "#f9fafb",
      color: text,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };

    const errorStyle: CSSProperties = {
      marginTop: "0.75rem",
      padding: "0.6rem",
      borderRadius: "0.5rem",
      backgroundColor: darkMode ? "#3f1d1d" : "#fee2e2",
      color: darkMode ? "#fecaca" : "#b91c1c",
      fontSize: "0.85rem",
      border: `1px solid ${darkMode ? "#7f1d1d" : "#fecaca"}`,
    };

    const footerStyle: CSSProperties = {
      marginTop: "0.9rem",
      fontSize: "0.75rem",
      color: muted,
    };

    const themeBtnStyle: CSSProperties = {
      position: "fixed",
      top: 16,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 999,
      border: `1px solid ${border}`,
      backgroundColor: cardBg,
      color: text,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      boxShadow: darkMode
        ? "0 10px 25px rgba(0,0,0,0.35)"
        : "0 10px 25px rgba(0,0,0,0.12)",
      zIndex: 9999,
    };


    return {
      containerStyle,
      cardStyle,
      titleStyle,
      subtitleStyle,
      labelStyle,
      inputStyle,
      checkboxRowStyle,
      buttonStyle,
      smallBtnStyle,
      errorStyle,
      footerStyle,
      themeBtnStyle,
      text,
      border,
    };
  }, [darkMode]);

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
          data?.error ||
          "No se ha podido iniciar sesión. Revisa las credenciales.";
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

      if (rememberUser) localStorage.setItem("rememberedUser", username);
      else localStorage.removeItem("rememberedUser");

      if (userData.role === "admin") navigate("/admin", { replace: true });
      else navigate("/perfil", { replace: true });
    } catch (err) {
      console.error("Error en login:", err);
      setErrorMsg("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.containerStyle}>
      {/* Botón modo oscuro (abajo a la derecha para que no tape nada) */}
      <button
        type="button"
        onClick={() => setDarkMode((v) => !v)}
        style={styles.themeBtnStyle}
        aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        title={darkMode ? "Modo claro" : "Modo oscuro"}
      >
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </button>

      <div style={styles.cardStyle}>
        <h1 style={styles.titleStyle}>Acceso al registro de jornada</h1>
        <p style={styles.subtitleStyle}>
          Introduce tus credenciales corporativas para acceder.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.85rem" }}>
            <label style={styles.labelStyle} htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              style={styles.inputStyle}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: "0.65rem" }}>
            <label style={styles.labelStyle} htmlFor="password">
              Contraseña
            </label>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                style={{ ...styles.inputStyle, flexGrow: 1 }}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                style={styles.smallBtnStyle}
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
            <label style={styles.checkboxRowStyle}>
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
              ...styles.buttonStyle,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Accediendo..." : "Entrar"}
          </button>

          {errorMsg && <div style={styles.errorStyle}>{errorMsg}</div>}

          <div style={styles.footerStyle}>
            <span>
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
