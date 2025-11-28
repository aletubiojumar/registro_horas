import React, { useEffect, useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const containerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f3f4f6",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  backgroundColor: "#ffffff",
  padding: "2rem",
  borderRadius: "0.5rem",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "0.9rem",
  marginBottom: "0.25rem",
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.35rem",
  border: "1px solid #d1d5db",
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  padding: "0.6rem 1rem",
  borderRadius: "0.35rem",
  border: "none",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontWeight: 500,
  fontSize: "0.95rem",
  cursor: "pointer",
};

const errorStyle: CSSProperties = {
  color: "#dc2626",
  fontSize: "0.85rem",
  marginTop: "0.5rem",
};

const smallTextStyle: CSSProperties = {
  fontSize: "0.8rem",
  color: "#4b5563",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "0.5rem",
};

const checkboxLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  fontSize: "0.8rem",
  color: "#4b5563",
};

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [rememberUser, setRememberUser] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Al cargar la pantalla, intentar recuperar el usuario guardado
  useEffect(() => {
    const savedUsername = localStorage.getItem("rh_username");
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberUser(true);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const trimmedUsername = username.trim();
    const error = await login(trimmedUsername, password);
    setIsSubmitting(false);

    if (error === "USER_NOT_FOUND") {
      setErrorMsg("El usuario no existe. Contacte con administración.");
      return;
    }

    if (error === "BAD_CREDENTIALS") {
      setErrorMsg("Usuario o contraseña incorrectos.");
      return;
    }

    // Login correcto → gestionar "recordar usuario"
    if (rememberUser) {
      localStorage.setItem("rh_username", trimmedUsername);
    } else {
      localStorage.removeItem("rh_username");
    }

    // Más adelante esto apuntará a /horas
    navigate("/horas");
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1
          style={{
            fontSize: "1.5rem",
            marginBottom: "1.5rem",
            textAlign: "center",
          }}
        >
          Control de horas
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="username" style={labelStyle}>
              Usuario
            </label>
            <input
              id="username"
              type="text"
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label htmlFor="password" style={labelStyle}>
              Contraseña
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div style={checkboxRowStyle}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={rememberUser}
                onChange={(e) => setRememberUser(e.target.checked)}
              />
              Recordar usuario
            </label>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              Mostrar contraseña
            </label>
          </div>

          {errorMsg && <div style={errorStyle}>{errorMsg}</div>}

          <button type="submit" style={buttonStyle} disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Iniciar sesión"}
          </button>

          <p style={{ ...smallTextStyle, marginTop: "0.75rem" }}>
            (En esta demo el usuario válido es <b>alejandro</b> y la contraseña{" "}
            <b>1234</b>).
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
