import React from "react";
import type { CSSProperties } from "react";

interface VacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  monthIndex: number;
  selectedVacations: number[];
  onToggleDay: (day: number) => void;
  maxDays: number;
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modalStyle: CSSProperties = {
  backgroundColor: "#fff",
  padding: "1.5rem",
  borderRadius: "0.5rem",
  width: "320px",
  maxHeight: "90vh",
  overflowY: "auto",
};

const dayCell: CSSProperties = {
  width: "38px",
  height: "38px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "5px",
  cursor: "pointer",
  userSelect: "none",
  border: "1px solid #d1d5db",
  fontSize: "0.8rem",
};

const VacationModal: React.FC<VacationModalProps> = ({
  isOpen,
  onClose,
  year,
  monthIndex,
  selectedVacations,
  onToggleDay,
  maxDays,
}) => {
  if (!isOpen) return null;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const weeks: number[][] = [];
  let currentWeek: number[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    const weekday = new Date(year, monthIndex, day).getDay();
    if (weekday === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
  }).format(new Date(year, monthIndex, 1));

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, textTransform: "capitalize" }}>
          Vacaciones de {monthName} {year}
        </h2>

        <p style={{ fontSize: "0.8rem", color: "#6b7280" }}>
          Selecciona hasta {maxDays} días.
          Vacaciones seleccionadas:{" "}
          <strong>{selectedVacations.length}</strong> / {maxDays}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 38px)",
            gap: "5px",
            marginTop: "1rem",
          }}
        >
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const selected = selectedVacations.includes(day);
            return (
              <div
                key={day}
                style={{
                  ...dayCell,
                  backgroundColor: selected ? "#bfdbfe" : "#fff",
                  borderColor: selected ? "#60a5fa" : "#d1d5db",
                }}
                onClick={() => onToggleDay(day)}
              >
                {day}
              </div>
            );
          })}
        </div>

        <button
          style={{
            marginTop: "1.2rem",
            padding: "0.5rem 1rem",
            width: "100%",
            borderRadius: "0.35rem",
            border: "none",
            backgroundColor: "#2563eb",
            color: "#fff",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          Aceptar
        </button>
      </div>
    </div>
  );
};

export default VacationModal;
