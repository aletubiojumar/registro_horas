import React, { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import DayRow from "../components/DayRow";
import type { DayHours } from "../components/DayRow";
import SignatureModal from "../components/SignatureModal";

const pageContainerStyle: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f3f4f6",
};

const headerStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  padding: "0.75rem 1.5rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
};

const mainStyle: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "1.5rem 0.5rem 2rem",
};

const monthBarStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "0.75rem",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const navButtonStyle: CSSProperties = {
  padding: "0.2rem 0.5rem",
  fontSize: "0.8rem",
  borderRadius: "0.25rem",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  cursor: "pointer",
};

const actionButtonStyle: CSSProperties = {
  padding: "0.35rem 0.75rem",
  fontSize: "0.8rem",
  borderRadius: "0.25rem",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  padding: "0.4rem 0.9rem",
  fontSize: "0.85rem",
  borderRadius: "0.3rem",
  border: "none",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  cursor: "pointer",
};

const tableContainerStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "0.5rem",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  overflowX: "auto",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 900,
};

const thStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: "0.35rem",
  backgroundColor: "#f9fafb",
  fontSize: "0.7rem",
  whiteSpace: "nowrap",
};

const footerBarStyle: CSSProperties = {
  marginTop: "0.75rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.75rem",
  color: "#4b5563",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const legendStyle: CSSProperties = {
  marginTop: "0.5rem",
  fontSize: "0.75rem",
  color: "#4b5563",
};

const signatureStatusStyle: CSSProperties = {
  fontSize: "0.75rem",
  color: "#4b5563",
};

const errorBannerStyle: CSSProperties = {
  backgroundColor: "#fee2e2",
  border: "1px solid #fca5a5",
  color: "#b91c1c",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
  marginBottom: "0.75rem",
};

const summaryBarStyle: CSSProperties = {
  marginTop: "0.5rem",
  fontSize: "0.8rem",
  color: "#374151",
};

// Utilidades de fechas
const getDaysInMonth = (year: number, monthIndex0: number): number => {
  return new Date(year, monthIndex0 + 1, 0).getDate();
};

const isWeekend = (year: number, monthIndex0: number, day: number): boolean => {
  const d = new Date(year, monthIndex0, day);
  const dayOfWeek = d.getDay(); // 0 = domingo, 6 = sábado
  return dayOfWeek === 0 || dayOfWeek === 6;
};

const isFutureDay = (year: number, monthIndex0: number, day: number): boolean => {
  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const thisDay = new Date(year, monthIndex0, day);
  return thisDay > todayDateOnly;
};

const getWeekdayLabel = (
  year: number,
  monthIndex0: number,
  day: number
): string => {
  const d = new Date(year, monthIndex0, day);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
  }).format(d);
};

// Helpers de tiempo y validación
const diffMinutes = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin - startMin;
};

const calculateTotal = (value: DayHours): string => {
  const m = diffMinutes(value.morningIn, value.morningOut);
  const t = diffMinutes(value.afternoonIn, value.afternoonOut);
  const totalMinutes = Math.max(m, 0) + Math.max(t, 0);
  if (totalMinutes === 0) return "";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const mm = minutes.toString().padStart(2, "0");
  return `${hours}:${mm}`;
};

type DayValidationResult = {
  totalMinutes: number;
  errors: string[];
};

const validateDay = (value: DayHours): DayValidationResult => {
  const errors: string[] = [];

  // Mañana
  if (value.morningIn || value.morningOut) {
    const diff = diffMinutes(value.morningIn, value.morningOut);
    if (!value.morningIn || !value.morningOut) {
      // si falta uno, no suma horas, pero no es error de coherencia
    } else if (diff < 0) {
      errors.push(
        "Tramo de mañana: la hora de salida no puede ser anterior a la de entrada."
      );
    }
  }

  // Tarde
  if (value.afternoonIn || value.afternoonOut) {
    const diff = diffMinutes(value.afternoonIn, value.afternoonOut);
    if (!value.afternoonIn || !value.afternoonOut) {
      // igual que mañana
    } else if (diff < 0) {
      errors.push(
        "Tramo de tarde: la hora de salida no puede ser anterior a la de entrada."
      );
    }
  }

  const morningMinutes =
    value.morningIn &&
    value.morningOut &&
    diffMinutes(value.morningIn, value.morningOut) > 0
      ? diffMinutes(value.morningIn, value.morningOut)
      : 0;

  const afternoonMinutes =
    value.afternoonIn &&
    value.afternoonOut &&
    diffMinutes(value.afternoonIn, value.afternoonOut) > 0
      ? diffMinutes(value.afternoonIn, value.afternoonOut)
      : 0;

  const totalMinutes = morningMinutes + afternoonMinutes;

  if (totalMinutes > 8 * 60) {
    errors.push(
      `Se han registrado más de 8 horas (${Math.floor(
        totalMinutes / 60
      )}h ${totalMinutes % 60}min).`
    );
  }

  return { totalMinutes, errors };
};

const HoursPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth()); // 0-11
  const [days, setDays] = useState<DayHours[]>([]);

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  const [copiedDayIndex, setCopiedDayIndex] = useState<number | null>(null);

  const [dayErrors, setDayErrors] = useState<Record<number, string[]>>({});
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const daysInMonth = useMemo(
    () => getDaysInMonth(year, monthIndex),
    [year, monthIndex]
  );

  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
  }).format(new Date(year, monthIndex, 1));

  const isLastDayOfCurrentMonth = useMemo(() => {
    const todayLocal = new Date();
    const tomorrow = new Date(todayLocal);
    tomorrow.setDate(todayLocal.getDate() + 1);
    return todayLocal.getMonth() !== tomorrow.getMonth();
  }, []);

  const storageKey = (username: string, year: number, monthIndex: number) =>
    `registro_horas:${username}:${year}-${monthIndex}`;

  // Cargar desde localStorage cuando cambian usuario/año/mes
  useEffect(() => {
    if (!user) return;

    const key = storageKey(user.username, year, monthIndex);
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          days?: DayHours[];
          signatureDataUrl?: string | null;
        };

        if (
          parsed.days &&
          Array.isArray(parsed.days) &&
          parsed.days.length === daysInMonth
        ) {
          setDays(parsed.days);
        } else {
          const newDays: DayHours[] = [];
          for (let d = 1; d <= daysInMonth; d++) {
            newDays.push({
              day: d,
              morningIn: "",
              morningOut: "",
              afternoonIn: "",
              afternoonOut: "",
              total: "",
            });
          }
          setDays(newDays);
        }

        if (typeof parsed.signatureDataUrl === "string") {
          setSignatureDataUrl(parsed.signatureDataUrl);
        } else {
          setSignatureDataUrl(null);
        }
      } catch (e) {
        // Si hay algo corrupto, inicializamos vacío
        const newDays: DayHours[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          newDays.push({
            day: d,
            morningIn: "",
            morningOut: "",
            afternoonIn: "",
            afternoonOut: "",
            total: "",
          });
        }
        setDays(newDays);
        setSignatureDataUrl(null);
      }
    } else {
      const newDays: DayHours[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        newDays.push({
          day: d,
          morningIn: "",
          morningOut: "",
          afternoonIn: "",
          afternoonOut: "",
          total: "",
        });
      }
      setDays(newDays);
      setSignatureDataUrl(null);
    }

    setCopiedDayIndex(null);
    setDayErrors({});
    setErrorMessages([]);
    setHasUnsavedChanges(false);
  }, [user, year, monthIndex, daysInMonth]);

  // Guardar en localStorage cuando cambian días o firma
  useEffect(() => {
    if (!user) return;
    if (days.length === 0) return;

    const key = storageKey(user.username, year, monthIndex);
    const payload = {
      days,
      signatureDataUrl,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [user, year, monthIndex, days, signatureDataUrl]);

  // --- Validación global ---

  const validateAllDays = (): boolean => {
    const daysWithErrors: string[] = [];
    const perDayErrors: Record<number, string[]> = {};

    for (const d of days) {
      const { errors } = validateDay(d);
      if (errors.length > 0) {
        perDayErrors[d.day] = errors;
        daysWithErrors.push(
          `Día ${d.day}: ${errors
            .map((e) => e.replace(/^Tramo de /, ""))
            .join(" | ")}`
        );
      }
    }

    setDayErrors(perDayErrors);
    setErrorMessages(daysWithErrors);

    if (daysWithErrors.length > 0) {
      alert(
        "Hay errores en el registro de horas. Revísalos en el cuadro rojo encima de la tabla."
      );
      return false;
    }

    return true;
  };

  // --- Resumen de horas del mes ---

  const monthSummary = useMemo(() => {
    let totalMinutes = 0;
    let daysWithHours = 0;
    let workingDays = 0;

    for (const d of days) {
      const weekend = isWeekend(year, monthIndex, d.day);
      const future = isFutureDay(year, monthIndex, d.day);
      if (!weekend) {
        if (!future || d.morningIn || d.morningOut || d.afternoonIn || d.afternoonOut) {
          workingDays++;
        }
      }

      const { totalMinutes: dayMinutes } = validateDay(d);
      if (dayMinutes > 0) {
        totalMinutes += dayMinutes;
        daysWithHours++;
      }
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const mm = minutes.toString().padStart(2, "0");

    return {
      totalMinutes,
      totalFormatted: `${hours}:${mm}`,
      daysWithHours,
      workingDays,
    };
  }, [days, year, monthIndex]);

  // --- Handlers ---

  const handleDayChange = (index: number, newValue: DayHours) => {
    const updated = [...days];
    updated[index] = {
      ...newValue,
      total: calculateTotal(newValue),
    };
    setDays(updated);
    setHasUnsavedChanges(true);
  };

  const askBeforeMonthChange = (): boolean => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "Tienes cambios en este mes que aún no has enviado (Guardar horas / Generar plantilla). " +
        "La información se guarda en este navegador, pero puede que no esté enviada a administración. ¿Quieres cambiar de mes igualmente?"
    );
  };

  const handlePrevMonth = () => {
    if (!askBeforeMonthChange()) return;
    const prev = new Date(year, monthIndex - 1, 1);
    setYear(prev.getFullYear());
    setMonthIndex(prev.getMonth());
  };

  const handleNextMonth = () => {
    if (!askBeforeMonthChange()) return;
    const next = new Date(year, monthIndex + 1, 1);
    setYear(next.getFullYear());
    setMonthIndex(next.getMonth());
  };

  const handleSaveHours = () => {
    if (!validateAllDays()) return;

    console.log("Horas del mes (simulado):", {
      year,
      monthIndex,
      days,
      signatureDataUrl,
    });
    setHasUnsavedChanges(false);
    alert(
      "Horas válidas y guardadas en memoria (simulado, sin backend). La firma también se tendrá en cuenta al generar el PDF."
    );
  };

  const handleGenerateTemplate = () => {
    if (!validateAllDays()) return;

    setHasUnsavedChanges(false);
    alert(
      "Generar plantilla (simulado). Más adelante descargará el PDF con la plantilla oficial y la firma en las celdas correspondientes."
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSignatureSaved = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setHasUnsavedChanges(true);
  };

  const handleClearSignature = () => {
    const confirmClear = window.confirm(
      "¿Seguro que quieres eliminar la firma guardada?"
    );
    if (!confirmClear) return;
    setSignatureDataUrl(null);
    setHasUnsavedChanges(true);
  };

  // --- Copiar / pegar horas ---

  const pasteFromIndex = (sourceIndex: number) => {
    const source = days[sourceIndex];
    const updated = [...days];

    let affected = 0;

    for (let i = sourceIndex + 1; i < updated.length; i++) {
      const target = updated[i];
      const dayNumber = target.day;

      const weekend = isWeekend(year, monthIndex, dayNumber);
      const future = isFutureDay(year, monthIndex, dayNumber);

      // No copiar a fines de semana ni a días futuros
      if (weekend || future) continue;

      // No machacar días que ya tienen horas
      const hasAnyExisting =
        target.morningIn ||
        target.morningOut ||
        target.afternoonIn ||
        target.afternoonOut;

      if (hasAnyExisting) continue;

      const newDay: DayHours = {
        ...target,
        morningIn: source.morningIn,
        morningOut: source.morningOut,
        afternoonIn: source.afternoonIn,
        afternoonOut: source.afternoonOut,
        total: "",
      };

      newDay.total = calculateTotal(newDay);
      updated[i] = newDay;
      affected++;
    }

    if (affected === 0) {
      alert(
        "No se han encontrado días posteriores vacíos (laborables y no futuros) donde pegar las horas."
      );
    } else {
      setDays(updated);
      setHasUnsavedChanges(true);
      alert(
        `Horas pegadas en ${affected} día(s) posterior(es) vacíos (solo laborables, no futuros).`
      );
    }
  };

  const handleCopyOrPasteDay = (index: number) => {
    const day = days[index];

    // Si ya es la plantilla -> ahora hace de "Pegar"
    if (copiedDayIndex === index) {
      pasteFromIndex(index);
      return;
    }

    // Modo "Copiar"
    const hasAny =
      day.morningIn || day.morningOut || day.afternoonIn || day.afternoonOut;

    if (!hasAny) {
      alert(
        `El día ${day.day} no tiene horas registradas. Registra las horas primero para poder copiarlas.`
      );
      return;
    }

    const { errors } = validateDay(day);
    if (errors.length > 0) {
      alert(
        `No se puede usar el día ${day.day} como origen porque tiene errores:\n\n- ${errors.join(
          "\n- "
        )}`
      );
      return;
    }

    // Guardamos índice como plantilla
    setCopiedDayIndex(index);
  };

  const handleClearDay = (index: number) => {
    const d = days[index];
    const hasAny =
      d.morningIn || d.morningOut || d.afternoonIn || d.afternoonOut;
    if (!hasAny) return;

    const updated = [...days];
    updated[index] = {
      ...d,
      morningIn: "",
      morningOut: "",
      afternoonIn: "",
      afternoonOut: "",
      total: "",
    };
    setDays(updated);
    setHasUnsavedChanges(true);

    // Limpia errores si los hubiera
    if (dayErrors[d.day]) {
      const newErrors = { ...dayErrors };
      delete newErrors[d.day];
      setDayErrors(newErrors);
      // recomponemos banner
      const msgs = Object.entries(newErrors).map(
        ([dayStr, errs]) =>
          `Día ${dayStr}: ${errs
            .map((e) => e.replace(/^Tramo de /, ""))
            .join(" | ")}`
      );
      setErrorMessages(msgs);
    }
  };

  return (
    <div style={pageContainerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>
            Registro diario de jornada
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Usuario: <strong>{user?.username}</strong>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            fontSize: "0.8rem",
            color: "#dc2626",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Cerrar sesión
        </button>
      </header>

      {/* Main */}
      <main style={mainStyle}>
        {/* Barra superior mes y acciones */}
        <section style={monthBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <button style={navButtonStyle} onClick={handlePrevMonth}>
              ◀
            </button>
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {monthName} {year}
              {hasUnsavedChanges && (
                <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "#b45309" }}>
                  • cambios sin enviar
                </span>
              )}
            </span>
            <button style={navButtonStyle} onClick={handleNextMonth}>
              ▶
            </button>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              alignItems: "flex-end",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                style={actionButtonStyle}
                type="button"
                onClick={() => setIsSignatureModalOpen(true)}
              >
                {signatureDataUrl ? "Modificar firma" : "Registrar firma"}
              </button>
              {signatureDataUrl && (
                <button
                  style={{
                    ...actionButtonStyle,
                    borderColor: "#dc2626",
                    color: "#dc2626",
                  }}
                  type="button"
                  onClick={handleClearSignature}
                >
                  Eliminar firma
                </button>
              )}
              <button style={actionButtonStyle} onClick={handleSaveHours}>
                Guardar horas (simulado)
              </button>
            </div>
            <div style={signatureStatusStyle}>
              Firma:{" "}
              {signatureDataUrl ? (
                <span style={{ color: "#16a34a", fontWeight: 500 }}>
                  registrada
                </span>
              ) : (
                <span style={{ color: "#dc2626" }}>no registrada</span>
              )}
            </div>
          </div>
        </section>

        {/* Banner de errores */}
        {errorMessages.length > 0 && (
          <section style={errorBannerStyle}>
            <strong>Hay errores en algunos días:</strong>
            <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0 }}>
              {errorMessages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Tabla de días */}
        <section style={tableContainerStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Día</th>
                <th style={thStyle}>Día semana</th>
                {/* Mañana */}
                <th style={thStyle}>Mañana entrada</th>
                <th style={thStyle}>Firma</th>
                <th style={thStyle}>Mañana salida</th>
                <th style={thStyle}>Firma</th>
                {/* Tarde */}
                <th style={thStyle}>Tarde entrada</th>
                <th style={thStyle}>Firma</th>
                <th style={thStyle}>Tarde salida</th>
                <th style={thStyle}>Firma</th>
                {/* Total */}
                <th style={thStyle}>Total</th>
                {/* Acción copiar/pegar */}
                <th style={thStyle}>Copiar / pegar</th>
                {/* Acción limpiar */}
                <th style={thStyle}>Limpiar</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d, idx) => {
                const weekend = isWeekend(year, monthIndex, d.day);
                const future = isFutureDay(year, monthIndex, d.day);
                const disabled = weekend || future;
                const weekdayLabel = getWeekdayLabel(year, monthIndex, d.day);

                // Mostrar firma en cualquier día que tenga horas (y exista firma)
                const hasAnyHours =
                  d.morningIn ||
                  d.morningOut ||
                  d.afternoonIn ||
                  d.afternoonOut;
                const signatureForRow =
                  signatureDataUrl && hasAnyHours ? signatureDataUrl : null;

                const hasError = !!dayErrors[d.day]?.length;

                return (
                  <DayRow
                    key={d.day}
                    value={d}
                    onChange={(newValue) => handleDayChange(idx, newValue)}
                    disabled={disabled}
                    isWeekend={weekend}
                    isFuture={future}
                    weekdayLabel={weekdayLabel}
                    signatureDataUrl={signatureForRow}
                    onCopyOrPasteClick={() => handleCopyOrPasteDay(idx)}
                    isCopySource={copiedDayIndex === idx}
                    hasError={hasError}
                    onClearClick={() => handleClearDay(idx)}
                  />
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Resumen de horas */}
        <section style={summaryBarStyle}>
          <div>
            Total horas del mes:{" "}
            <strong>{monthSummary.totalFormatted}</strong> {" · "}
            Días con horas registradas:{" "}
            <strong>
              {monthSummary.daysWithHours} / {monthSummary.workingDays}
            </strong>
          </div>
        </section>

        {/* Leyenda y botón generar plantilla */}
        <div style={legendStyle}>
          <div>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#fef3c7",
                border: "1px solid #e5e7eb",
                marginRight: "0.25rem",
                verticalAlign: "middle",
              }}
            />{" "}
            Fines de semana (no editables)
          </div>
          <div style={{ marginTop: "0.15rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#e5e7eb",
                border: "1px solid #d1d5db",
                marginRight: "0.25rem",
                verticalAlign: "middle",
              }}
            />{" "}
            Días futuros (no editables)
          </div>
        </div>

        <section style={footerBarStyle}>
          <div>
            {isLastDayOfCurrentMonth ? (
              <span>Hoy es el último día del mes. Puedes cerrar la jornada.</span>
            ) : (
              <span>
                Solo se debería generar la plantilla el último día del mes
                (simulado).
              </span>
            )}
          </div>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: isLastDayOfCurrentMonth ? 1 : 0.6,
              cursor: isLastDayOfCurrentMonth ? "pointer" : "not-allowed",
            }}
            disabled={!isLastDayOfCurrentMonth}
            onClick={handleGenerateTemplate}
          >
            Generar plantilla (simulado)
          </button>
        </section>
      </main>

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSignatureSaved}
      />
    </div>
  );
};

export default HoursPage;
