import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AdminUser } from "./UserList";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

interface UserDataEditorProps {
  user: AdminUser;
  onUserUpdated: (user: AdminUser) => void;
}

const UserDataEditor: React.FC<UserDataEditorProps> = ({
  user,
  onUserUpdated,
}) => {
  const { user: admin, logout } = useAuth();

  const [username, setUsername] = useState(user.username || "");
  const [password, setPassword] = useState(""); // Vacío por defecto, solo se actualiza si se modifica
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState(user.fullName || "");
  const [vacationDaysPerYear, setVacationDaysPerYear] = useState(
    user.vacationDaysPerYear || 23
  );
  const [workCenter, setWorkCenter] = useState(user.workCenter || "");
  const [companyCif, setCompanyCif] = useState(user.companyCif || "");
  const [companyCcc, setCompanyCcc] = useState(user.companyCcc || "");
  const [workerLastName, setWorkerLastName] = useState(
    user.workerLastName || ""
  );
  const [workerFirstName, setWorkerFirstName] = useState(
    user.workerFirstName || ""
  );
  const [workerNif, setWorkerNif] = useState(user.workerNif || "");
  const [workerSsNumber, setWorkerSsNumber] = useState(
    user.workerSsNumber || ""
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Resetear campos cuando cambia el usuario seleccionado
  useEffect(() => {
    setUsername(user.username || "");
    setPassword(""); // No mostramos la contraseña actual
    setShowPassword(false);
    setFullName(user.fullName || "");
    setVacationDaysPerYear(user.vacationDaysPerYear || 23);
    setWorkCenter(user.workCenter || "");
    setCompanyCif(user.companyCif || "");
    setCompanyCcc(user.companyCcc || "");
    setWorkerLastName(user.workerLastName || "");
    setWorkerFirstName(user.workerFirstName || "");
    setWorkerNif(user.workerNif || "");
    setWorkerSsNumber(user.workerSsNumber || "");
    setSaveMessage(null);
  }, [user.id]);

  const handleSave = async () => {
    if (!admin?.token) {
      alert("Sesión no válida. Vuelve a iniciar sesión.");
      logout();
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${admin.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password: password || undefined, // Solo enviamos si hay algo
          fullName,
          vacationDaysPerYear,
          workCenter,
          companyCif,
          companyCcc,
          workerLastName,
          workerFirstName,
          workerNif,
          workerSsNumber,
        }),
      });

      if (res.status === 401) {
        alert("Sesión caducada. Vuelve a iniciar sesión.");
        logout();
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setSaveMessage({
          type: "error",
          text: err?.error || "Error al guardar los datos del usuario.",
        });
        return;
      }

      const data = await res.json();
      const updatedUser: AdminUser = data.user;

      setSaveMessage({
        type: "success",
        text: "Datos guardados correctamente.",
      });

      onUserUpdated(updatedUser);
    } catch (err) {
      console.error(err);
      setSaveMessage({
        type: "error",
        text: "No se ha podido conectar con el servidor.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: "1rem" }}>
        Editar datos: {user.fullName}
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          maxWidth: "800px",
          marginBottom: "1.5rem",
        }}
      >
        {/* Usuario */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Usuario (login):
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* Contraseña */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Contraseña:
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
              style={{
                flex: 1,
                padding: "0.4rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.35rem",
                fontSize: "0.85rem",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                padding: "0.4rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.35rem",
                backgroundColor: "#f9fafb",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "0.25rem" }}>
            Deja este campo vacío si no quieres cambiar la contraseña
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          maxWidth: "800px",
        }}
      >
        {/* Nombre completo */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Nombre completo:
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* Días de vacaciones */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Días de vacaciones al año:
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={vacationDaysPerYear}
            onChange={(e) => setVacationDaysPerYear(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>
      </div>

      <hr style={{ margin: "1.5rem 0", border: "none", borderTop: "1px solid #e5e7eb" }} />

      <h3 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 600 }}>
        Datos para la cabecera del PDF
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          maxWidth: "800px",
        }}
      >
        {/* Centro de trabajo */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Centro de trabajo:
          </label>
          <input
            type="text"
            value={workCenter}
            onChange={(e) => setWorkCenter(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* CIF */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            CIF de la empresa:
          </label>
          <input
            type="text"
            value={companyCif}
            onChange={(e) => setCompanyCif(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* CCC */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Código de Cuenta de Cotización:
          </label>
          <input
            type="text"
            value={companyCcc}
            onChange={(e) => setCompanyCcc(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* Apellidos trabajador */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Apellidos del trabajador:
          </label>
          <input
            type="text"
            value={workerLastName}
            onChange={(e) => setWorkerLastName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* Nombre trabajador */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Nombre del trabajador:
          </label>
          <input
            type="text"
            value={workerFirstName}
            onChange={(e) => setWorkerFirstName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* NIF */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            NIF del trabajador:
          </label>
          <input
            type="text"
            value={workerNif}
            onChange={(e) => setWorkerNif(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>

        {/* Número SS */}
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 500,
              marginBottom: "0.25rem",
            }}
          >
            Nº afiliación Seguridad Social:
          </label>
          <input
            type="text"
            value={workerSsNumber}
            onChange={(e) => setWorkerSsNumber(e.target.value)}
            style={{
              width: "100%",
              padding: "0.4rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.35rem",
              fontSize: "0.85rem",
            }}
          />
        </div>
      </div>

      {/* Mensaje de guardado */}
      {saveMessage && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "0.35rem",
            backgroundColor:
              saveMessage.type === "success" ? "#dcfce7" : "#fee2e2",
            color: saveMessage.type === "success" ? "#166534" : "#b91c1c",
            fontSize: "0.85rem",
          }}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Botón guardar */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        style={{
          marginTop: "1.5rem",
          padding: "0.5rem 1.5rem",
          borderRadius: "0.35rem",
          border: "none",
          backgroundColor: "#2563eb",
          color: "#ffffff",
          fontSize: "0.9rem",
          fontWeight: 500,
          cursor: isSaving ? "not-allowed" : "pointer",
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        {isSaving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
};

export default UserDataEditor;