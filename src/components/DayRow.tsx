import React from "react";
import type { ChangeEvent, CSSProperties } from "react";

export type DayHours = {
  day: number;
  morningIn: string;
  morningOut: string;
  afternoonIn: string;
  afternoonOut: string;
  total: string; // texto tipo "8:00"
};

type Props = {
  value: DayHours;
  onChange: (newValue: DayHours) => void;
  disabled: boolean;
  isWeekend: boolean;
  isFuture: boolean;
  weekdayLabel: string;
  signatureDataUrl: string | null; // firma para ESTA fila (o null)
  onCopyOrPasteClick: () => void;   // copiar o pegar
  isCopySource: boolean;            // si esta fila es la plantilla actual
  hasError: boolean;                // si este día tiene errores de validación
  onClearClick: () => void;         // limpiar este día
};

const cellInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.15rem 0.25rem",
  fontSize: "0.8rem",
};

const signatureCellBaseStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: "0.15rem 0.25rem",
  textAlign: "center",
};

const smallButtonStyle: CSSProperties = {
  padding: "0.15rem 0.35rem",
  fontSize: "0.7rem",
  borderRadius: "0.25rem",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  cursor: "pointer",
};

const dangerButtonStyle: CSSProperties = {
  ...smallButtonStyle,
  borderColor: "#dc2626",
  color: "#dc2626",
};

const DayRow = ({
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
}: Props) => {
  const handleFieldChange =
    (field: keyof DayHours) => (e: ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      onChange({ ...value, [field]: e.target.value });
    };

  let backgroundColor = "#ffffff";

  if (isWeekend) backgroundColor = "#fef3c7";
  if (isFuture) backgroundColor = "#e5e7eb";
  if (hasError) backgroundColor = "#fee2e2"; // errores mandan

  if (isCopySource) {
    // si es plantilla, la resaltamos un poco más
    backgroundColor = "#dbeafe";
  }

  const rowStyle: CSSProperties = {
    backgroundColor,
    opacity: disabled ? 0.7 : 1,
  };

  const dayCellStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    padding: "0.25rem 0.5rem",
    textAlign: "center",
    fontSize: "0.8rem",
    fontWeight: isWeekend ? 600 : 400,
  };

  const weekdayCellStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    padding: "0.25rem 0.5rem",
    textAlign: "center",
    fontSize: "0.75rem",
    textTransform: "capitalize",
    color: "#4b5563",
  };

  const editableCellStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    padding: "0.25rem",
  };

  const totalCellStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    padding: "0.25rem 0.5rem",
    textAlign: "center",
    fontSize: "0.8rem",
  };

  const actionCellStyle: CSSProperties = {
    border: "1px solid #e5e7eb",
    padding: "0.25rem 0.5rem",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  const renderSignatureCell = () => {
    if (!signatureDataUrl) {
      return <span style={{ fontSize: "0.7rem", color: "#9ca3af" }}>—</span>;
    }
    return (
      <img
        src={signatureDataUrl}
        alt="firma"
        style={{ maxHeight: "20px", maxWidth: "70px", objectFit: "contain" }}
      />
    );
  };

  const hasAnyHours =
    value.morningIn ||
    value.morningOut ||
    value.afternoonIn ||
    value.afternoonOut;

  const copyButtonLabel = isCopySource ? "Pegar" : "Copiar";

  return (
    <tr style={rowStyle}>
      <td style={dayCellStyle}>{value.day}</td>
      <td style={weekdayCellStyle}>{weekdayLabel}</td>

      {/* Mañana entrada */}
      <td style={editableCellStyle}>
        <input
          type="time"
          value={value.morningIn}
          onChange={handleFieldChange("morningIn")}
          style={cellInputStyle}
          disabled={disabled}
        />
      </td>
      {/* Mañana firma entrada */}
      <td style={signatureCellBaseStyle}>{renderSignatureCell()}</td>

      {/* Mañana salida */}
      <td style={editableCellStyle}>
        <input
          type="time"
          value={value.morningOut}
          onChange={handleFieldChange("morningOut")}
          style={cellInputStyle}
          disabled={disabled}
        />
      </td>
      {/* Mañana firma salida */}
      <td style={signatureCellBaseStyle}>{renderSignatureCell()}</td>

      {/* Tarde entrada */}
      <td style={editableCellStyle}>
        <input
          type="time"
          value={value.afternoonIn}
          onChange={handleFieldChange("afternoonIn")}
          style={cellInputStyle}
          disabled={disabled}
        />
      </td>
      {/* Tarde firma entrada */}
      <td style={signatureCellBaseStyle}>{renderSignatureCell()}</td>

      {/* Tarde salida */}
      <td style={editableCellStyle}>
        <input
          type="time"
          value={value.afternoonOut}
          onChange={handleFieldChange("afternoonOut")}
          style={cellInputStyle}
          disabled={disabled}
        />
      </td>
      {/* Tarde firma salida */}
      <td style={signatureCellBaseStyle}>{renderSignatureCell()}</td>

      {/* Total día */}
      <td style={totalCellStyle}>{value.total}</td>

      {/* Acción copiar/pegar */}
      <td style={actionCellStyle}>
        <button
          type="button"
          style={smallButtonStyle}
          onClick={onCopyOrPasteClick}
          disabled={!hasAnyHours && !isCopySource}
        >
          {copyButtonLabel}
        </button>
      </td>

      {/* Acción limpiar */}
      <td style={actionCellStyle}>
        <button
          type="button"
          style={dangerButtonStyle}
          onClick={onClearClick}
          disabled={!hasAnyHours}
        >
          Limpiar
        </button>
      </td>
    </tr>
  );
};

export default DayRow;
