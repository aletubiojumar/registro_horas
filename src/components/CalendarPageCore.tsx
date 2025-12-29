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

// ✅ CORREGIDO: Función robusta para detectar fines de semana
const isWeekend = (dateStr: string): boolean => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dayOfWeek = d.getDay(); // 0=domingo, 6=sábado
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const isFutureDay = (dateStr: string): boolean => {
  const today = new Date();
  // Normalizar a medianoche local
  const todayStr = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    .toISOString()
    .slice(0, 10);
  return dateStr > todayStr;
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

  // Paleta de colores (simplificada para claridad)
  const palette = {
    border: theme?.border ?? "#e5e7eb",
    text: theme?.text ?? "#111827",
    muted: theme?.muted ?? "#4b5563",
    cardBg: theme?.cardBg ?? "#ffffff",
    inputBg: theme?.inputBg ?? "#ffffff",
    inputBorder: theme?.inputBorder ?? "#d1d5db",
    primary: theme?.primary ?? "#2563eb",
    
    dayHeaderText: dark ? "#94a3b8" : "#4b5563",
    cellBorder: dark ? (theme?.border ?? "#334155") : "#e5e7eb",
    cellText: dark ? "#e5e7eb" : "#111827",
    
    // ✅ CORREGIDO: Solo fines de semana = amarillo/dorado
    bgWeekend: dark ? "#451a03" : "#fef3c7", // Más intenso en modo oscuro
    
    bgDefault: dark ? "#0b1220" : "#ffffff",
    bgFuture: dark ? "#0f172a" : "#f9fafb",
    
    bgVacApproved: dark ? "#0b3a6f" : "#bfdbfe",
    bdVacApproved: dark ? "#2563eb" : "#60a5fa",
    bgVacPending: dark ? "#4c2a06" : "#fed7aa",
    bdVacPending: dark ? "#f59e0b" : "#fb923c",
    
    colorByType: dark ? {
      visita: "#0f2a1a",
      juicio: "#241338",
      vacaciones: "#4c2a06",
      "cita médica": "#3b0f18",
      "citación judicial": "#241338",
      otros: "#0f172a",
    } : {
      visita: "#dcfce7",
      juicio: "#e9d5ff",
      vacaciones: "#fed7aa",
      "cita médica": "#fecdd3",
      "citación judicial": "#e9d5ff",
      otros: "#e5e7eb",
    },
    
    pillBg: dark ? "#0f172a" : "#ffffff",
    pillBorder: dark ? "#334155" : "#d1d5db",
    pillText: dark ? "#e5e7eb" : "#111827",
    
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

  // ✅ CORREGIDO: Cálculo más claro y robusto del padding
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=domingo, 6=sábado
  const startPadding = (firstDayOfMonth + 6) % 7; // Convierte: Lunes=0, Martes=1, ..., Domingo=6

  console.log(`startPadding para ${monthName}:`, startPadding, 
              `(1 del mes cae en día ${["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][firstDayOfMonth]})`);

  return (
    <div style={{ color: palette.text }}>
      {/* Selector de mes */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <button 
          onClick={handlePrev} 
          style={{
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
            border: `1px solid ${palette.inputBorder}`,
            backgroundColor: palette.inputBg,
            color: palette.text,
            cursor: "pointer",
          }}
        >
          ◀
        </button>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
          {monthName}
        </span>
        <button 
          onClick={handleNext} 
          style={{
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
            border: `1px solid ${palette.inputBorder}`,
            backgroundColor: palette.inputBg,
            color: palette.text,
            cursor: "pointer",
          }}
        >
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

      {/* Cuadrícula del calendario */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.5rem",
          textAlign: "center",
        }}
      >
        {/* Encabezados de días */}
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

        {/* Espacios vacíos al inicio del mes */}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div 
            key={`empty-${i}`}
            style={{
              minHeight: 70,
              border: `1px solid transparent`,
            }}
          />
        ))}

        {/* Días del mes */}
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

          // ✅ CORREGIDO: Prioridad de colores clara
          let bg = palette.bgDefault;

          if (vacApproved) {
            bg = palette.bgVacApproved;
          } else if (vacPending) {
            bg = palette.bgVacPending;
          } else if (weekend) {
            bg = palette.bgWeekend; // ✅ ESTO es lo que quieres - solo fines de semana
          } else if (dayEvents.length > 0) {
            // Si hay eventos (no vacaciones), usa color por tipo
            const firstEventType = dayEvents[0].type as keyof typeof palette.colorByType;
            bg = palette.colorByType[firstEventType] ?? palette.bgDefault;
          } else if (future) {
            bg = palette.bgFuture;
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