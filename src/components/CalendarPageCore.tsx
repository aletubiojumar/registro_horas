import React, { useState } from "react";
import type { CalendarEvent } from "../pages/CalendarPage";

const colorByType: Record<any, string> = {
  visita: "#dcfce7",
  juicio: "#e9d5ff",
  vacaciones: "#fed7aa",
  "cita médica": "#fecdd3",
  otros: "#e5e7eb",
};

const isWeekend = (date: string): boolean => {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6;
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
}

const CalendarPageCore: React.FC<Props> = ({
  events,
  readOnly = false,
  onApproveVacation,
}) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

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

  return (
    <div>
      {/* Selector mes */}
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
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
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
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            cursor: "pointer",
          }}
        >
          ▶
        </button>
      </div>

      {/* Leyenda */}
      <div style={{ fontSize: "0.75rem", color: "#4b5563", marginBottom: "0.5rem" }}>
        <div>
          <span
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              backgroundColor: "#fef3c7",
              border: "1px solid #e5e7eb",
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
              backgroundColor: "#bfdbfe",
              border: "1px solid #60a5fa",
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
              backgroundColor: "#fed7aa",
              border: "1px solid #fb923c",
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
              color: "#4b5563",
              padding: "0.25rem",
            }}
          >
            {d}
          </div>
        ))}

        {monthDays.map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = events.filter((e) => e.date === dateStr);
          const weekend = isWeekend(dateStr);
          const future = isFutureDay(dateStr);

          const vacPending = dayEvents.some((e) => e.type === "vacaciones" && e.status === "pending");
          const vacApproved = dayEvents.some((e) => e.type === "vacaciones" && e.status === "approved");

          let bg = "#fff";
          if (vacApproved) bg = "#bfdbfe";
          else if (vacPending) bg = "#fed7aa";
          else if (weekend) bg = "#fef3c7";
          else {
            const types = dayEvents.map((e) => e.type) as any[];
            if (types.length) bg = colorByType[types[0]];
            else if (future) bg = "#e5e7eb";
          }

          return (
            <div
              key={day}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "0.25rem",
                padding: "0.35rem",
                minHeight: 70,
                backgroundColor: bg,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                {day}
              </div>
              {dayEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    fontSize: "0.65rem",
                    marginTop: "0.15rem",
                    padding: "0.1rem 0.3rem",
                    border: "1px solid #d1d5db",
                    borderRadius: "0.25rem",
                    background: "#ffffff",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
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
                            border: "1px solid #16a34a",
                            backgroundColor: "#dcfce7",
                            color: "#166534",
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
                            border: "1px solid #dc2626",
                            backgroundColor: "#fee2e2",
                            color: "#b91c1c",
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