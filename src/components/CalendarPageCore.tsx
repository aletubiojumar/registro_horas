import { useState } from "react";
import type { CalendarEvent } from "../pages/CalendarPage";

type Theme = {
  darkMode: boolean;
  border: string;
  text: string;
  muted: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
};

const isWeekend = (dateStr: string): boolean => {
  // Parsear la fecha correctamente sin problemas de zona horaria
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay();
  // 0 = domingo, 6 = sábado
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const isFutureDay = (date: string): boolean => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return date > todayStr;
};

interface Props {
  events: CalendarEvent[];
  readOnly?: boolean;
  onApproveVacation?: (id: string, approve: boolean) => void;
  theme?: Theme;
}

const CalendarPageCore: React.FC<Props> = ({
  events,
  readOnly = false,
  onApproveVacation,
  theme,
}) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const dark = theme?.darkMode ?? false;

  // Paleta interna (si no pasas theme, usa claro por defecto)
  const palette = {
    border: theme?.border ?? "#e5e7eb",
    text: theme?.text ?? "#111827",
    muted: theme?.muted ?? "#4b5563",
    cardBg: theme?.cardBg ?? "#ffffff",
    inputBg: theme?.inputBg ?? "#ffffff",
    inputBorder: theme?.inputBorder ?? "#d1d5db",
    primary: theme?.primary ?? "#2563eb",

    // Colores específicos del calendario
    dayHeaderText: dark ? "#94a3b8" : "#4b5563",

    cellBorder: dark ? (theme?.border ?? "#334155") : "#e5e7eb",
    cellText: dark ? "#e5e7eb" : "#111827",

    // Fondo de celda según estado
    bgDefault: dark ? "#0b1220" : "#ffffff",
    bgFuture: dark ? "#0f172a" : "#f9fafb",
    bgWeekend: dark ? "#111827" : "#fef3c7",

    bgVacApproved: dark ? "#0b3a6f" : "#bfdbfe",
    bdVacApproved: dark ? "#2563eb" : "#60a5fa",

    bgVacPending: dark ? "#4c2a06" : "#fed7aa",
    bdVacPending: dark ? "#f59e0b" : "#fb923c",

    // "Color por tipo" (en oscuro usamos versiones más profundas)
    colorByType: ((): Record<any, string> => {
      if (!dark) {
        return {
          visita: "#dcfce7",
          juicio: "#e9d5ff",
          vacaciones: "#fed7aa",
          "cita médica": "#fecdd3",
          "citación judicial": "#e9d5ff", // Mismo que juicio
          otros: "#e5e7eb",
        };
      }
      return {
        visita: "#0f2a1a",
        juicio: "#241338",
        vacaciones: "#4c2a06",
        "cita médica": "#3b0f18",
        "citación judicial": "#241338", // Mismo que juicio
        otros: "#0f172a",
      };
    })(),

    // "pill" de evento dentro de una celda
    pillBg: dark ? "#0f172a" : "#ffffff",
    pillBorder: dark ? "#334155" : "#d1d5db",
    pillText: dark ? "#e5e7eb" : "#111827",

    // Botones aprobar/rechazar
    okBg: dark ? "#0f2a1a" : "#dcfce7",
    okBd: dark ? "#22c55e" : "#16a34a",
    okTx: dark ? "#86efac" : "#166534",

    noBg: dark ? "#3b0f18" : "#fee2e2",
    noBd: dark ? "#ef4444" : "#dc2626",
    noTx: dark ? "#fecaca" : "#b91c1c",
  };

  const monthDays = Array.from(
    { length: new Date(year, month + 1, 0).getDate() },
    (_, i) => i + 1
  );

  const monthName = new Date(year, month).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  const handlePrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const navBtnStyle: React.CSSProperties = {
    padding: "0.2rem 0.5rem",
    borderRadius: "0.25rem",
    border: `1px solid ${palette.inputBorder}`,
    backgroundColor: palette.inputBg,
    color: palette.text,
    cursor: "pointer",
  };

  // Obtener el primer día del mes para saber cuántos espacios vacíos necesitamos
  // getDay() retorna: 0=domingo, 1=lunes, 2=martes, ..., 6=sábado
  // Necesitamos convertir a: lunes=0, martes=1, ..., domingo=6
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startPadding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  return (
    <div style={{ color: palette.text }}>
      {/* Selector mes */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <button onClick={handlePrev} style={navBtnStyle}>
          ◀
        </button>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
          {monthName}
        </span>
        <button onClick={handleNext} style={navBtnStyle}>
          ▶
        </button>
      </div>

      {/* Leyenda */}
      <div style={{ fontSize: "0.75rem", color: palette.muted, marginBottom: "0.5rem" }}>
        <div>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              backgroundColor: palette.bgWeekend,
              border: `1px solid ${palette.cellBorder}`,
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          Fin de semana
        </div>
        <div>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              backgroundColor: palette.bgVacApproved,
              border: `1px solid ${palette.bdVacApproved}`,
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          Vacaciones aprobadas
        </div>
        <div>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              backgroundColor: palette.bgVacPending,
              border: `1px solid ${palette.bdVacPending}`,
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          Vacaciones pendientes
        </div>
      </div>

      {/* Cuadrícula */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.5rem",
          textAlign: "center",
        }}
      >
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div
            key={d}
            style={{
              fontWeight: 600,
              fontSize: "0.75rem",
              color: palette.dayHeaderText,
              padding: "0.25rem",
            }}
          >
            {d}
          </div>
        ))}

        {/* Espacios vacíos al inicio */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div 
            key={`empty-${i}`}
            style={{
              minHeight: 70,
              border: `1px solid transparent`,
            }}
          />
        ))}

        {monthDays.map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
            day
          ).padStart(2, "0")}`;

          const dayEvents = events.filter((e) => e.date === dateStr);
          const weekend = isWeekend(dateStr);
          const future = isFutureDay(dateStr);

          const vacPending = dayEvents.some(
            (e) => e.type === "vacaciones" && e.status === "pending"
          );
          const vacApproved = dayEvents.some(
            (e) => e.type === "vacaciones" && e.status === "approved"
          );

          let bg = palette.bgDefault;

          if (vacApproved) bg = palette.bgVacApproved;
          else if (vacPending) bg = palette.bgVacPending;
          else if (weekend) bg = palette.bgWeekend;
          else {
            const types = dayEvents.map((e) => e.type) as any[];
            if (types.length) bg = palette.colorByType[types[0]] ?? palette.bgDefault;
            else if (future) bg = palette.bgFuture;
          }

          return (
            <div
              key={day}
              style={{
                border: `1px solid ${palette.cellBorder}`,
                borderRadius: "0.25rem",
                padding: "0.35rem",
                minHeight: 70,
                backgroundColor: bg,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  marginBottom: "0.25rem",
                  color: palette.cellText,
                  opacity: future ? 0.8 : 1,
                }}
              >
                {day}
              </div>

              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    fontSize: "0.65rem",
                    marginTop: "0.15rem",
                    padding: "0.1rem 0.3rem",
                    border: `1px solid ${palette.pillBorder}`,
                    borderRadius: "0.25rem",
                    background: palette.pillBg,
                    color: palette.pillText,
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  {ev.type === "citación judicial" && "⚖️ "}
                  {ev.type}
                  {ev.type === "vacaciones" && ev.status === "pending" && (
                    <span title="Pendiente de aprobación"> ⏳</span>
                  )}

                  {ev.type === "vacaciones" &&
                    ev.status === "pending" &&
                    readOnly &&
                    onApproveVacation && (
                      <div style={{ marginTop: "0.2rem" }}>
                        <button
                          onClick={() => onApproveVacation(ev.id, true)}
                          style={{
                            padding: "0.1rem 0.3rem",
                            fontSize: "0.6rem",
                            marginRight: "0.2rem",
                            borderRadius: "0.2rem",
                            border: `1px solid ${palette.okBd}`,
                            backgroundColor: palette.okBg,
                            color: palette.okTx,
                            cursor: "pointer",
                          }}
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => onApproveVacation(ev.id, false)}
                          style={{
                            padding: "0.1rem 0.3rem",
                            fontSize: "0.6rem",
                            borderRadius: "0.2rem",
                            border: `1px solid ${palette.noBd}`,
                            backgroundColor: palette.noBg,
                            color: palette.noTx,
                            cursor: "pointer",
                          }}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { CalendarPageCore };