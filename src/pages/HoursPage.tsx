import React, { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import DayRow from "../components/DayRow";
import type { DayHours } from "../components/DayRow";
import SignatureModal from "../components/SignatureModal";
import VacationModal from "../components/VacationModal";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

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
  minWidth: 1020,
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
  flexWrap: "nowrap",
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

  // Si hay ausencia (vacaciones, día no lectivo o ausencia médica),
  // no aplicamos validación de horas.
  if (value.absenceType !== "none") {
    return { totalMinutes: 0, errors: [] };
  }

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

type DayPayloadFromApi = {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
};

type MonthFromApi = {
  year: number;
  month: number;
  days: DayPayloadFromApi[];
  signatureDataUrl?: string | null;
};

const HoursPage = () => {
  const { user, logout } = useAuth();
  const token = user?.token ?? "";

  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth()); // 0-11
  const [days, setDays] = useState<DayHours[]>([]);
  const [isLoadingMonth, setIsLoadingMonth] = useState(false);

  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  const [copiedDayIndex, setCopiedDayIndex] = useState<number | null>(null);

  const [dayErrors, setDayErrors] = useState<Record<number, string[]>>({});
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Ficheros de justificante médico por día (solo en front por ahora)
  const [medicalFiles, setMedicalFiles] = useState<Record<number, File | null>>(
    {}
  );

  // Modal de vacaciones y días seleccionados
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false);
  const [selectedVacations, setSelectedVacations] = useState<number[]>([]);
  const MAX_VACATION_DAYS = 23;

  const daysInMonth = useMemo(
    () => getDaysInMonth(year, monthIndex),
    [year, monthIndex]
  );

  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
  }).format(new Date(year, monthIndex, 1));

  // Inicializar días vacíos
  const createEmptyDays = (): DayHours[] => {
    const arr: DayHours[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({
        day: d,
        morningIn: "",
        morningOut: "",
        afternoonIn: "",
        afternoonOut: "",
        total: "",
        absenceType: "none",
      });
    }
    return arr;
  };

  // Cargar datos del backend cuando cambian año/mes
  useEffect(() => {
    if (!token || !user) return;

    const fetchMonth = async () => {
      setIsLoadingMonth(true);
      setDayErrors({});
      setErrorMessages([]);
      setCopiedDayIndex(null);
      setMedicalFiles({});
      setSelectedVacations([]);

      try {
        const queryMonth = monthIndex + 1; // 1-12
        const res = await fetch(
          `${API_BASE_URL}/hours?year=${year}&month=${queryMonth}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.status === 401) {
          alert("Sesión caducada. Vuelve a iniciar sesión.");
          logout();
          navigate("/login");
          return;
        }

        if (!res.ok) {
          console.error("Error cargando horas:", await res.text());
          setDays(createEmptyDays());
          setSignatureDataUrl(null);
          return;
        }

        const json = (await res.json()) as {
          exists: boolean;
          data: MonthFromApi | null;
        };

        if (!json.exists || !json.data) {
          setDays(createEmptyDays());
          setSignatureDataUrl(null);
        } else {
          const serverMonth = json.data;
          const mappedDays: DayHours[] = [];

          for (let d = 1; d <= daysInMonth; d++) {
            const serverDay = serverMonth.days.find((x) => x.day === d);
            if (!serverDay) {
              mappedDays.push({
                day: d,
                morningIn: "",
                morningOut: "",
                afternoonIn: "",
                afternoonOut: "",
                total: "",
                absenceType: "none",
              });
            } else {
              const value: DayHours = {
                day: d,
                morningIn: serverDay.morningIn ?? "",
                morningOut: serverDay.morningOut ?? "",
                afternoonIn: serverDay.afternoonIn ?? "",
                afternoonOut: serverDay.afternoonOut ?? "",
                total: "",
                absenceType: "none", // el backend aún no conoce ausencias
              };
              value.total = calculateTotal(value);
              mappedDays.push(value);
            }
          }

          setDays(mappedDays);
          setSignatureDataUrl(serverMonth.signatureDataUrl ?? null);
        }

        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Error cargando mes:", error);
        setDays(createEmptyDays());
        setSignatureDataUrl(null);
      } finally {
        setIsLoadingMonth(false);
      }
    };

    fetchMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, monthIndex, token, user]);

  // --- Resumen de horas del mes ---

  const monthSummary = useMemo(() => {
    let totalMinutes = 0;
    let daysWithHours = 0;
    let workingDays = 0;

    for (const d of days) {
      const weekend = isWeekend(year, monthIndex, d.day);
      const future = isFutureDay(year, monthIndex, d.day);

      if (!weekend) {
        if (
          !future ||
          d.morningIn ||
          d.morningOut ||
          d.afternoonIn ||
          d.afternoonOut ||
          d.absenceType !== "none"
        ) {
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

  // --- Handlers de edición de día ---

  const handleDayChange = (index: number, newValue: DayHours) => {
    const updated = [...days];
    updated[index] = {
      ...newValue,
      total: newValue.absenceType === "none" ? calculateTotal(newValue) : "",
    };
    setDays(updated);
    setHasUnsavedChanges(true);
  };

  const handleMedicalFileChange = (day: number, file: File | null) => {
    setMedicalFiles((prev) => ({
      ...prev,
      [day]: file,
    }));
    setHasUnsavedChanges(true);
  };

  const askBeforeMonthChange = (): boolean => {
    if (!hasUnsavedChanges) return true;
    return window.confirm(
      "Tienes cambios en este mes que aún no has enviado. " +
        "¿Quieres cambiar de mes igualmente?"
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

  const saveMonthToBackend = async (): Promise<boolean> => {
    if (!token) {
      alert("No hay token de sesión. Vuelve a iniciar sesión.");
      logout();
      navigate("/login");
      return false;
    }

    const payload = {
      year,
      month: monthIndex + 1, // 1-12
      days: days.map((d) => ({
        day: d.day,
        morningIn: d.morningIn || undefined,
        morningOut: d.morningOut || undefined,
        afternoonIn: d.afternoonIn || undefined,
        afternoonOut: d.afternoonOut || undefined,
        // más adelante añadiremos ausencias y justificantes al backend
      })),
      signatureDataUrl,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/hours`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        alert("Sesión caducada. Vuelve a iniciar sesión.");
        logout();
        navigate("/login");
        return false;
      }

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error guardando horas:", txt);
        alert("Error al guardar las horas en el servidor.");
        return false;
      }

      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error("Error guardando horas:", error);
      alert("No se ha podido conectar con el servidor para guardar las horas.");
      return false;
    }
  };

  const downloadPdfForCurrentMonth = async (): Promise<boolean> => {
    if (!token) {
      alert("No hay token de sesión. Vuelve a iniciar sesión.");
      logout();
      navigate("/login");
      return false;
    }

    const queryMonth = monthIndex + 1;

    try {
      const res = await fetch(
        `${API_BASE_URL}/hours/pdf?year=${year}&month=${queryMonth}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401) {
        alert("Sesión caducada. Vuelve a iniciar sesión.");
        logout();
        navigate("/login");
        return false;
      }

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error generando PDF:", txt);
        alert("Error al generar el PDF en el servidor.");
        return false;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const monthPadded = String(queryMonth).padStart(2, "0");
      a.href = url;
      a.download = `registro_horas_${year}_${monthPadded}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error("Error descargando PDF:", error);
      alert("No se ha podido conectar con el servidor para generar el PDF.");
      return false;
    }
  };

  const handleSaveHours = async () => {
    if (!validateAllDays()) return;

    const ok = await saveMonthToBackend();
    if (ok) {
      alert(
        "Horas válidas y guardadas en el servidor (en memoria). La firma también se usará al generar el PDF."
      );
    }
  };

  const handleGenerateTemplate = async () => {
    if (!validateAllDays()) return;

    const okSave = await saveMonthToBackend();
    if (!okSave) return;

    await downloadPdfForCurrentMonth();
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

  // --- Selección de vacaciones ---

  const toggleVacationDay = (day: number) => {
    // si ya está seleccionado → quitar
    if (selectedVacations.includes(day)) {
      setSelectedVacations(selectedVacations.filter((d) => d !== day));

      const updated = [...days];
      const index = day - 1;
      updated[index] = {
        ...updated[index],
        absenceType: "none",
      };
      setDays(updated);
      setHasUnsavedChanges(true);
      return;
    }

    // si no, añadir (respetando el límite)
    if (selectedVacations.length >= MAX_VACATION_DAYS) {
      alert("No puedes seleccionar más de 23 días de vacaciones.");
      return;
    }

    setSelectedVacations([...selectedVacations, day]);

    const updated = [...days];
    const index = day - 1;
    updated[index] = {
      ...updated[index],
      absenceType: "vacaciones",
      morningIn: "",
      morningOut: "",
      afternoonIn: "",
      afternoonOut: "",
      total: "",
    };
    setDays(updated);
    setHasUnsavedChanges(true);
  };

  // --- Copiar / pegar horas / ausencias ---

  const handleCopyOrPasteDay = (index: number) => {
  // 1) No hay origen todavía → este click selecciona el día origen
  if (copiedDayIndex === null) {
    const day = days[index];

    const hasHours =
      day.morningIn ||
      day.morningOut ||
      day.afternoonIn ||
      day.afternoonOut;
    const hasAbsence = day.absenceType !== "none";

    if (!hasHours && !hasAbsence) {
      alert(
        `El día ${day.day} no tiene horas ni ausencia registrada. No hay nada que copiar.`
      );
      return;
    }

    // Si hay horas, comprobamos que sean coherentes
    if (hasHours) {
      const { errors } = validateDay(day);
      if (errors.length > 0) {
        alert(
          `No se puede usar el día ${day.day} como origen porque tiene errores:\n\n- ${errors.join(
            "\n- "
          )}`
        );
        return;
      }
    }

    setCopiedDayIndex(index);
    return;
  }

  // 2) Ya hay origen → este click pega en el rango
  const sourceIndex = copiedDayIndex;

  // Si clicas otra vez en el origen, cancelamos modo copia
  if (sourceIndex === index) {
    setCopiedDayIndex(null);
    return;
  }

  const source = days[sourceIndex];
  const from = Math.min(sourceIndex, index);
  const to = Math.max(sourceIndex, index);

  const updated = [...days];
  let affected = 0;

  // Vacaciones: contamos solo días con ausencia "vacaciones"
  const currentVacationDays = days.filter(
    (d) => d.absenceType === "vacaciones"
  ).length;
  let remainingVacations = MAX_VACATION_DAYS - currentVacationDays;

  for (let i = from + 1; i <= to; i++) {
    const target = updated[i];
    const dayNumber = target.day;

    const weekend = isWeekend(year, monthIndex, dayNumber);
    if (weekend) continue; // nunca tocamos fines de semana

    const future = isFutureDay(year, monthIndex, dayNumber);

    // Si el origen tiene HORAS y el día destino es futuro → no pegamos horas en futuros
    if (source.absenceType === "none" && future) {
      continue;
    }

    let newDay: DayHours;

    if (source.absenceType !== "none") {
      // Estamos copiando una AUSENCIA

      if (source.absenceType === "vacaciones") {
        const alreadyVacation = target.absenceType === "vacaciones";

        // Solo consumimos días del cupo si el destino no era ya vacaciones
        if (!alreadyVacation) {
          if (remainingVacations <= 0) {
            // No nos quedan días de vacaciones disponibles → saltamos este día
            continue;
          }
          remainingVacations--;
        }
      }

      // Copiamos la ausencia y limpiamos horas
      newDay = {
        ...target,
        morningIn: "",
        morningOut: "",
        afternoonIn: "",
        afternoonOut: "",
        total: "",
        absenceType: source.absenceType,
        medicalJustificationFileName: undefined, // no copiamos justificantes
      };
    } else {
      // Estamos copiando HORAS (sin ausencia)
      newDay = {
        ...target,
        morningIn: source.morningIn,
        morningOut: source.morningOut,
        afternoonIn: source.afternoonIn,
        afternoonOut: source.afternoonOut,
        total: "",
        absenceType: "none",
        medicalJustificationFileName: undefined,
      };
      newDay.total = calculateTotal(newDay);
    }

    updated[i] = newDay;
    affected++;
  }

  if (affected === 0) {
    alert(
      "No se han encontrado días válidos en el rango seleccionado para pegar."
    );
  } else {
    alert(`Datos aplicados en ${affected} día(s) dentro del rango seleccionado.`);
    setDays(updated);
    setHasUnsavedChanges(true);
  }

  // Salimos del modo copia
  setCopiedDayIndex(null);
};


  const handleClearDay = (index: number) => {
    const d = days[index];
    const hasAny =
      d.morningIn ||
      d.morningOut ||
      d.afternoonIn ||
      d.afternoonOut ||
      d.absenceType !== "none" ||
      d.medicalJustificationFileName;

    if (!hasAny) return;

    const updated = [...days];
    updated[index] = {
      ...d,
      morningIn: "",
      morningOut: "",
      afternoonIn: "",
      afternoonOut: "",
      total: "",
      absenceType: "none",
      medicalJustificationFileName: undefined,
    };
    setDays(updated);
    setHasUnsavedChanges(true);

    setMedicalFiles((prev) => {
      const next = { ...prev };
      delete next[d.day];
      return next;
    });

    if (selectedVacations.includes(d.day)) {
      setSelectedVacations(selectedVacations.filter((x) => x !== d.day));
    }

    if (dayErrors[d.day]) {
      const newErrors = { ...dayErrors };
      delete newErrors[d.day];
      setDayErrors(newErrors);
      const msgs = Object.entries(newErrors).map(
        ([dayStr, errs]) =>
          `Día ${dayStr}: ${errs
            .map((e) => e.replace(/^Tramo de /, ""))
            .join(" | ")}`
      );
      setErrorMessages(msgs);
    }
  };

  if (!user || !token) {
    navigate("/login");
    return null;
  }

  return (
    <div style={pageContainerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>
            Registro diario de jornada
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Usuario: <strong>{user.username}</strong> ({user.fullName})
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
                <span
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.7rem",
                    color: "#b45309",
                  }}
                >
                  • cambios sin enviar
                </span>
              )}
              {isLoadingMonth && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.7rem",
                    color: "#4b5563",
                  }}
                >
                  (cargando…)
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
                onClick={() => setIsVacationModalOpen(true)}
              >
                Seleccionar vacaciones
              </button>

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
              <button
                style={actionButtonStyle}
                onClick={handleSaveHours}
                disabled={isLoadingMonth}
              >
                Guardar horas
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
                {/* Ausencia */}
                <th style={thStyle}>Ausencia</th>
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
                    // Cuando hay un día copiado, TODOS los botones muestran "Pegar"
                    isCopySource={copiedDayIndex !== null}
                    hasError={hasError}
                    onClearClick={() => handleClearDay(idx)}
                    onMedicalFileChange={handleMedicalFileChange}
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
          <div style={{ marginTop: "0.15rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#bfdbfe",
                border: "1px solid #60a5fa",
                marginRight: "0.25rem",
                verticalAlign: "middle",
              }}
            />{" "}
            Días con vacaciones
          </div>
          <div style={{ marginTop: "0.15rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#e9d5ff",
                border: "1px solid #c4b5fd",
                marginRight: "0.25rem",
                verticalAlign: "middle",
              }}
            />{" "}
            Día no lectivo
          </div>
          <div style={{ marginTop: "0.15rem" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                backgroundColor: "#fecdd3",
                border: "1px solid #fca5a5",
                marginRight: "0.25rem",
                verticalAlign: "middle",
              }}
            />{" "}
            Ausencia médica
          </div>
        </div>

        <section style={footerBarStyle}>
          <div style={{ whiteSpace: "nowrap" }}>
            Puedes generar el PDF en cualquier momento.
          </div>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: isLoadingMonth ? 0.6 : 1,
              cursor: isLoadingMonth ? "not-allowed" : "pointer",
            }}
            disabled={isLoadingMonth}
            onClick={handleGenerateTemplate}
          >
            Generar plantilla (descargar PDF)
          </button>
        </section>
      </main>

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSignatureSaved}
      />

      <VacationModal
        isOpen={isVacationModalOpen}
        onClose={() => setIsVacationModalOpen(false)}
        year={year}
        monthIndex={monthIndex}
        selectedVacations={selectedVacations}
        onToggleDay={toggleVacationDay}
        maxDays={MAX_VACATION_DAYS}
      />
    </div>
  );
};

export default HoursPage;
