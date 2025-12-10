import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f3f4f6",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "400px",
  backgroundColor: "#ffffff",
  borderRadius: "0.75rem",
  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  padding: "1.75rem 1.5rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 600,
  marginBottom: "0.25rem",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#6b7280",
  marginBottom: "1.25rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "#374151",
  marginBottom: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.4rem 0.5rem",
  borderRadius: "0.375rem",
  border: "1px solid #d1d5db",
  fontSize: "0.85rem",
};

const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  fontSize: "0.8rem",
  color: "#4b5563",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "1rem",
  padding: "0.5rem",
  borderRadius: "0.375rem",
  border: "none",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "0.9rem",
  fontWeight: 500,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  padding: "0.5rem",
  borderRadius: "0.375rem",
  backgroundColor: "#fee2e2",
  color: "#b91c1c",
  fontSize: "0.8rem",
};

const footerStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  fontSize: "0.75rem",
  color: "#6b7280",
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberUser, setRememberUser] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        const message =
          err?.error || "No se ha podido iniciar sesión. Revisa las credenciales.";
        setErrorMsg(message);
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();

      // data = { token, user: { id, username, fullName, role } }
      login({
        id: data.user.id,
        username: data.user.username,
        fullName: data.user.fullName,
        role: data.user.role,
        token: data.token,
      });

      console.log("Rol recibido:", data.user.role);
      if (data.user.role === "admin") {
        console.log("Redirigiendo a /admin");
        navigate("/admin", { replace: true });
      } else {
        console.log("Redirigiendo a /perfil");
        navigate("/perfil", { replace: true });
      }

      if (rememberUser) {
        localStorage.setItem("rememberedUser", username);
      } else {
        localStorage.removeItem("rememberedUser");
      }

    } catch (err) {
      console.error("Error en login:", err);
      setErrorMsg("Error de conexión con el servidor.");
      setIsSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
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
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
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
            <span style={{ color: "#9ca3af" }}>
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
