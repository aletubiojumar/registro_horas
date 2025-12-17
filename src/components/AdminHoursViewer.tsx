import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

type User = {
  id: string;
  fullName: string;
};

type Theme = {
  border: string;
  text: string;
  muted: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  dangerText: string;
  primary: string;
};

interface AdminHoursViewerProps {
  user: User;
  theme: Theme;
}

type AbsenceType =
  | "none"
  | "vacaciones"
  | "dia_no_lectivo"
  | "ausencia_medica";

interface StoredDay {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  totalMinutes?: number;
  absenceType?: AbsenceType;
  hasSignature?: boolean;
}

interface MonthHours {
  userId: string;
  year: number;
  month: number;
  days: StoredDay[];
  signatureDataUrl?: string | null;
}

interface AdminHoursResponse {
  exists: boolean;
  data: MonthHours | null;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

const labelAbsence = (a?: AbsenceType) => {
  switch (a) {
    case "vacaciones":
      return "Vacaciones";
    case "dia_no_lectivo":
      return "Día no lectivo";
    case "ausencia_medica":
      return "Ausencia médica";
    case "none":
    default:
      return "Sin ausencia";
  }
};

const formatTotal = (totalMinutes?: number) => {
  if (!totalMinutes || totalMinutes <= 0) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
};

export default function AdminHoursViewer({
  user: selectedUser,
  theme,
}: AdminHoursViewerProps) {
  const { user: admin, logout } = useAuth();

  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(1);
  const [data, setData] = useState<AdminHoursResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    marginLeft: "0.25rem",
    borderRadius: "0.25rem",
    border: `1px solid ${theme.inputBorder}`,
    backgroundColor: theme.inputBg,
    color: theme.text,
    padding: "0.3rem 0.4rem",
    outline: "none",
  };

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "0.4rem 0.75rem",
    borderRadius: "0.35rem",
    border: primary ? `1px solid ${theme.primary}` : `1px solid ${theme.inputBorder}`,
    backgroundColor: primary ? theme.primary : theme.inputBg,
    color: primary ? "#fff" : theme.text,
    cursor: "pointer",
    opacity: isLoading ? 0.7 : 1,
  });

  const loadHours = async () => {
    if (!admin?.token) {
      alert("Sesión no válida. Vuelve a iniciar sesión.");
      logout();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/hours?userId=${selectedUser.id}&year=${year}&month=${month}`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );

      if (res.status === 401) {
        alert("Sesión caducada. Vuelve a iniciar sesión.");
        logout();
        return;
      }

      if (!res.ok) {
        console.error("Error cargando horas admin:", await res.text());
        alert("Error al cargar las horas de este usuario.");
        return;
      }

      const json = (await res.json()) as AdminHoursResponse;
      setData(json);
    } catch (err) {
      console.error(err);
      alert("No se ha podido conectar con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!admin?.token) {
      alert("Sesión no válida. Vuelve a iniciar sesión.");
      logout();
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/hours/pdf?userId=${selectedUser.id}&year=${year}&month=${month}`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );

      if (res.status === 401) {
        alert("Sesión caducada. Vuelve a iniciar sesión.");
        logout();
        return;
      }

      if (!res.ok) {
        console.error("Error generando PDF admin:", await res.text());
        alert("Error al generar el PDF de este usuario.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const monthPadded = String(month).padStart(2, "0");
      a.href = url;
      a.download = `registro_horas_${year}_${monthPadded}_${selectedUser.fullName}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("No se ha podido conectar con el servidor para generar el PDF.");
    }
  };

  const monthData = data?.exists && data.data ? data.data : null;

  return (
    <div style={{ color: theme.text }}>
      <h2>Horas de: {selectedUser.fullName}</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center" }}>
        <label>
          Año:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ ...inputStyle, width: "5.5rem" }}
          />
        </label>

        <label>
          Mes:
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            min={1}
            max={12}
            style={{ ...inputStyle, width: "3.5rem" }}
          />
        </label>

        <button onClick={loadHours} disabled={isLoading} style={btnStyle(true)}>
          {isLoading ? "Cargando..." : "Cargar"}
        </button>
        <button onClick={downloadPdf} disabled={isLoading || !monthData} style={btnStyle(false)}>
          Descargar PDF
        </button>
      </div>

      {!monthData && (
        <p style={{ fontSize: "0.85rem", color: theme.muted }}>
          {data?.exists === false
            ? "No hay datos de horas guardados para este mes."
            : "Sin datos cargados. Pulsa en «Cargar» para ver el detalle."}
        </p>
      )}

      {monthData && (
        <div
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: "0.5rem",
            padding: "0.75rem",
            fontSize: "0.8rem",
            backgroundColor: theme.cardBg,
          }}
        >
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>
              Mes {String(monthData.month).padStart(2, "0")} / {monthData.year}
            </strong>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr>
                {["Día", "Mañana", "Tarde", "Total (h)", "Ausencia"].map((h) => (
                  <th
                    key={h}
                    style={{
                      border: `1px solid ${theme.border}`,
                      padding: "0.35rem",
                      backgroundColor: theme.inputBg,
                      color: theme.text,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthData.days.map((d) => (
                <tr key={d.day}>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "0.25rem", textAlign: "center" }}>
                    {d.day}
                  </td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "0.25rem", textAlign: "center" }}>
                    {(d.morningIn || d.morningOut) &&
                      `${d.morningIn ?? "--:--"} - ${d.morningOut ?? "--:--"}`}
                  </td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "0.25rem", textAlign: "center" }}>
                    {(d.afternoonIn || d.afternoonOut) &&
                      `${d.afternoonIn ?? "--:--"} - ${d.afternoonOut ?? "--:--"}`}
                  </td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "0.25rem", textAlign: "center" }}>
                    {formatTotal(d.totalMinutes)}
                  </td>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "0.25rem", textAlign: "center" }}>
                    {labelAbsence(d.absenceType)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
