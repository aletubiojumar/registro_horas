import React from "react";
import type { ChangeEvent, CSSProperties } from "react";

export type AbsenceType =
  | "none"
  | "vacaciones"
  | "dia_no_lectivo"
  | "ausencia_medica";

export interface DayHours {
  day: number;
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
  total: string;
  absenceType: AbsenceType;
  // Solo para mostrar el nombre del archivo subido en ausencias médicas
  medicalJustificationFileName?: string;
}

interface DayRowProps {
  value: DayHours;
  onChange: (value: DayHours) => void;
  // En la práctica es "no se pueden introducir horas" (fines de semana o días futuros)
  disabled: boolean;
  isWeekend: boolean;
  isFuture: boolean;
  weekdayLabel: string;
  signatureDataUrl: string | null;
  onCopyOrPasteClick: () => void;
  isCopySource: boolean;
  hasError: boolean;
  onClearClick: () => void;
  onMedicalFileChange?: (day: number, file: File | null) => void;
}

const tdStyleBase: CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: "0.25rem",
  fontSize: "0.75rem",
  textAlign: "center",
};

const timeInputStyle: CSSProperties = {
  width: "4.2rem",
  padding: "0.1rem 0.2rem",
  fontSize: "0.75rem",
  borderRadius: "0.2rem",
  border: "1px solid #d1d5db",
  textAlign: "center",
  boxSizing: "border-box",
};

const totalCellStyle: CSSProperties = {
  ...tdStyleBase,
  fontWeight: 600,
  backgroundColor: "#f9fafb",
};

const buttonLinkStyle: CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.15rem 0.35rem",
  borderRadius: "0.25rem",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const DayRow: React.FC<DayRowProps> = ({
  value,
  onChange,
  disabled,
  isWeekend,
  isFuture,
  weekdayLabel,
  signatureDataUrl,
  onCopyOrPasteClick,
  isCopySource,
  hasError,
  onClearClick,
  onMedicalFileChange,
}) => {
  // 👉 Las horas sí se bloquean en días futuros o fines de semana
  const timeInputsDisabled = disabled || value.absenceType !== "none";

  // 👉 Calculamos el color de la fila:
  // - Fines de semana: amarillo
  // - Vacaciones: azul
  // - Día no lectivo: morado
  // - Ausencia médica: rosa
  // - Días futuros sin ausencia: gris
  // - Resto: blanco
  let bg = "#ffffff";

  if (isWeekend) {
    bg = "#fef3c7"; // amarillo suave
  } else if (value.absenceType === "vacaciones") {
    bg = "#bfdbfe"; // azul suave
  } else if (value.absenceType === "dia_no_lectivo") {
    bg = "#e9d5ff"; // morado suave
  } else if (value.absenceType === "ausencia_medica") {
    bg = "#fecdd3"; // rosa suave
  } else if (isFuture) {
    bg = "#e5e7eb"; // gris claro
  }

  const rowStyle: CSSProperties = {
    backgroundColor: bg,
  };

  if (hasError) {
    rowStyle.boxShadow = "inset 0 0 0 1px #fca5a5";
  }

  const handleTimeChange =
    (field: keyof DayHours) => (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const updated: DayHours = { ...value, [field]: newValue };
      onChange(updated);
    };

  const handleAbsenceChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as AbsenceType;
    let updated: DayHours = {
      ...value,
      absenceType: newType,
    };

    // Si ponemos una ausencia, limpiamos las horas
    if (newType !== "none") {
      updated = {
        ...updated,
        morningIn: "",
        morningOut: "",
        afternoonIn: "",
        afternoonOut: "",
        total: "",
      };
    }

    // Si ya no es ausencia médica, limpiamos el justificante
    if (newType !== "ausencia_medica") {
      updated.medicalJustificationFileName = undefined;
      if (onMedicalFileChange) {
        onMedicalFileChange(value.day, null);
      }
    }

    onChange(updated);
  };

  const handleMedicalFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    const updated: DayHours = {
      ...value,
      medicalJustificationFileName: file?.name ?? undefined,
    };
    onChange(updated);

    if (onMedicalFileChange) {
      onMedicalFileChange(value.day, file);
    }
  };

  const renderSignatureCell = () => {
    if (!signatureDataUrl) {
      return <td style={tdStyleBase}></td>;
    }

    return (
      <td style={tdStyleBase}>
        <img
          src={signatureDataUrl}
          alt="Firma"
          style={{ height: "22px", maxWidth: "90px", objectFit: "contain" }}
        />
      </td>
    );
  };

  const absenceDisabled = isWeekend;

  return (
    <tr style={rowStyle}>
      {/* Día */}
      <td style={tdStyleBase}>{value.day}</td>

      {/* Día semana */}
      <td style={tdStyleBase}>{weekdayLabel}</td>

      {/* Mañana entrada */}
      <td style={tdStyleBase}>
        <input
          type="time"
          value={value.morningIn}
          onChange={handleTimeChange("morningIn")}
          style={timeInputStyle}
          disabled={timeInputsDisabled}
        />
      </td>

      {/* Firma mañana entrada */}
      {renderSignatureCell()}

      {/* Mañana salida */}
      <td style={tdStyleBase}>
        <input
          type="time"
          value={value.morningOut}
          onChange={handleTimeChange("morningOut")}
          style={timeInputStyle}
          disabled={timeInputsDisabled}
        />
      </td>

      {/* Firma mañana salida */}
      {renderSignatureCell()}

      {/* Tarde entrada */}
      <td style={tdStyleBase}>
        <input
          type="time"
          value={value.afternoonIn}
          onChange={handleTimeChange("afternoonIn")}
          style={timeInputStyle}
          disabled={timeInputsDisabled}
        />
      </td>

      {/* Firma tarde entrada */}
      {renderSignatureCell()}

      {/* Tarde salida */}
      <td style={tdStyleBase}>
        <input
          type="time"
          value={value.afternoonOut}
          onChange={handleTimeChange("afternoonOut")}
          style={timeInputStyle}
          disabled={timeInputsDisabled}
        />
      </td>

      {/* Firma tarde salida */}
      {renderSignatureCell()}

      {/* Total */}
      <td style={totalCellStyle}>{value.total}</td>

      {/* Ausencia */}
      <td style={tdStyleBase}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          {/* 👉 OJO: el select de ausencia YA NO se deshabilita por días futuros.
              Solo usamos disabled para las horas, no para las ausencias. */}
          <select
            value={value.absenceType}
            onChange={handleAbsenceChange}
            disabled={absenceDisabled}
            style={{
              fontSize: "0.7rem",
              padding: "0.1rem 0.2rem",
              borderRadius: "0.2rem",
              border: "1px solid #d1d5db",
              backgroundColor: absenceDisabled ? "#f3f4f6" : "white",
            }}
          >
            <option value="none">Sin ausencia</option>
            <option value="vacaciones">Vacaciones</option>
            <option value="dia_no_lectivo">Día no lectivo</option>
            <option value="ausencia_medica">Ausencia médica</option>
          </select>

          {value.absenceType === "ausencia_medica" && (
            <div style={{ fontSize: "0.7rem", textAlign: "left" }}>
              <label>
                <span style={{ display: "inline-block", marginBottom: "0.1rem" }}>
                  Justificante:
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleMedicalFileChange}
                  style={{
                    display: "block",
                    width: "100%",
                    fontSize: "0.7rem",
                  }}
                />
              </label>
              {value.medicalJustificationFileName && (
                <div
                  style={{
                    marginTop: "0.1rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Archivo: <strong>{value.medicalJustificationFileName}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Copiar / pegar */}
      <td style={tdStyleBase}>
        <button
          type="button"
          disabled={isWeekend}
          onClick={isWeekend ? undefined : onCopyOrPasteClick}
          style={{
            ...buttonLinkStyle,
            backgroundColor: isWeekend
              ? "#f3f4f6"
              : isCopySource
              ? "#bfdbfe"
              : "#ffffff",
            borderColor: isWeekend
              ? "#d1d5db"
              : isCopySource
              ? "#60a5fa"
              : "#d1d5db",
            cursor: isWeekend ? "not-allowed" : "pointer",
            opacity: isWeekend ? 0.5 : 1,
          }}
        >
          {isCopySource ? "Pegar" : "Copiar"}
        </button>
      </td>

      {/* Limpiar */}
      <td style={tdStyleBase}>
        <button
          type="button"
          disabled={isWeekend}
          onClick={isWeekend ? undefined : onClearClick}
          style={{
            ...buttonLinkStyle,
            backgroundColor: isWeekend ? "#f3f4f6" : "#ffffff",
            cursor: isWeekend ? "not-allowed" : "pointer",
            opacity: isWeekend ? 0.5 : 1,
          }}
        >
          Limpiar
        </button>
      </td>
    </tr>
  );
};

export default DayRow;
