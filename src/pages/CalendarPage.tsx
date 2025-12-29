import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type EventType = "visita" | "juicio" | "vacaciones" | "cita médica" | "citación judicial" | "otros";
type Visibility = "only-me" | "all" | "some";

export interface CalendarEvent {
    id: string;
    ownerId: string;
    type: EventType;
    date: string; // YYYY-MM-DD
    status?: "pending" | "approved";
    visibility: Visibility;
    viewers?: string[];
    medicalJustificationFileName?: string;
}

const CalendarPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [medicalFile, setMedicalFile] = useState<File | null>(null);
    const [vacationDaysLeft, setVacationDaysLeft] = useState<number>(0);
    const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
    const [visibility, setVisibility] = useState<Visibility>("only-me");
    const [viewers, setViewers] = useState<string[]>([]);

    // Mes actual
    const [currentMonth, setCurrentMonth] = useState(() => {
        const today = new Date();
        return today.getMonth(); // Devuelve 11 para diciembre, 0 para enero, etc.
    });
    const [currentYear, setCurrentYear] = useState(() => {
        const today = new Date();
        return today.getFullYear(); // Devuelve 2025
    });

    // Modo selección de fin de vacaciones
    const [vacationMode, setVacationMode] = useState<null | string>(null);

    // Colores por tipo
    const colorByType: Record<EventType, string> = {
        visita: "#dcfce7",      // verde claro
        juicio: "#e9d5ff",      // morado claro
        vacaciones: "#fed7aa",  // naranja (pending) / azul (approved)
        "cita médica": "#fecdd3", // rosa
        "citación judicial": "#dbeafe", // azul claro
        otros: "#e5e7eb",        // gris
    };

    // Helper para saber si un día es fin de semana
    const isWeekend = (date: string): boolean => {
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
    };

    // Helper para saber si un día es futuro
    const isFutureDay = (date: string): boolean => {
        const today = new Date();
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const thisDay = new Date(date);
        return thisDay > todayDateOnly;
    };

    // En CalendarPage.tsx, al inicio del componente
    console.log("🔄 CalendarPage montado:", {
        user: user?.email,
        month: currentMonth + 1,
        year: currentYear,
        tokenPresent: !!user?.token
    });

    // Cargar usuarios (sin admin ni yo)
    useEffect(() => {
        // En el useEffect de carga
        console.log("📡 Solicitando eventos a:", `${API_BASE_URL}/calendar/events`);
        if (!user) return;
        fetch(`${API_BASE_URL}/calendar/users`, {
            headers: { Authorization: `Bearer ${user.token}` },
        })
            .then((r) => r.json())
            .then((data) => {
                const filtered = data.users.filter((u: any) => u.id !== user.id && u.role !== "admin");
                setUsers(filtered);
            })
            .catch(() => alert("Error al cargar usuarios"));
    }, [user]);

    // Cargar eventos visibles y días de vacaciones restantes
    // En CalendarPage.tsx, reemplaza TODO el useEffect de carga de eventos

    useEffect(() => {
        if (!user?.token) return;

        console.log("📅 Cargando calendario para usuario:", user.email);
        console.log("📅 Mes actual:", currentMonth + 1, "/", currentYear);

        const loadCalendarData = async () => {
            try {
                const [eventsRes, vacationRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/calendar/events`, {
                        headers: { Authorization: `Bearer ${user.token}` },
                    }),
                    fetch(`${API_BASE_URL}/calendar/vacation-days-left`, {
                        headers: { Authorization: `Bearer ${user.token}` },
                    }),
                ]);

                if (!eventsRes.ok) throw new Error(`Error al cargar eventos: ${eventsRes.status}`);
                if (!vacationRes.ok) throw new Error(`Error al cargar días de vacaciones: ${vacationRes.status}`);

                const eventsData = await eventsRes.json();
                const vacationData = await vacationRes.json();

                console.log("✅ Eventos recibidos:", eventsData.events?.length || 0);
                console.log("✅ Días de vacaciones disponibles:", vacationData.daysLeft);

                setEvents(eventsData.events || []);
                setVacationDaysLeft(vacationData.daysLeft);
            } catch (error) {
                console.error("❌ Error al cargar datos del calendario:", error);
                alert("No se pudieron cargar los eventos del calendario. Por favor, intenta de nuevo.");
            }
        };

        loadCalendarData();
    }, [user?.token, user?.id]); // Solo depende del token e ID de usuario

    // Mes anterior / siguiente
    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear((y) => y - 1);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };
    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    // Click en día → menú rápido o selección de fin
    const handleDayClick = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        if (vacationMode) {
            // Modo selección de FIN
            if (new Date(dateStr) < new Date(vacationMode)) {
                alert("El día de fin debe ser igual o posterior al de inicio");
                return;
            }
            // Enviar rango completo
            createVacationRangeFromTo(vacationMode, dateStr);
            setVacationMode(null);
        } else {
            // Modo normal
            setSelectedDay(dateStr);
            setVisibility("only-me");
            setViewers([]);
            setMedicalFile(null);
        }
    };

    // Editar/Borrar evento
    const handleEditEvent = (ev: CalendarEvent) => {
        setEditingEvent(ev);
    };

    // Actualizar tipo (sin alertas y con actualización local inmediata)
    const handleUpdateType = (newType: EventType) => {
        if (!editingEvent) return;

        // PROTECCIÓN: no permitir doble vacación el mismo día
        if (newType === "vacaciones") {
            const existing = events.filter(
                (e) => e.date === editingEvent.date && e.type === "vacaciones" && e.id !== editingEvent.id
            );
            if (existing.length > 0) {
                alert("Ya existe un evento de vacaciones este día");
                setEditingEvent(null);
                return;
            }
            if (vacationDaysLeft <= 0) {
                alert("No te quedan días de vacaciones");
                setEditingEvent(null);
                return;
            }
        }

        // Actualización local inmediata
        const updated: CalendarEvent = {
            ...editingEvent,
            type: newType,
            status: newType === "vacaciones" ? "pending" : undefined,
        };

        // Ajustamos días localmente
        if (editingEvent.type === "vacaciones" && editingEvent.status === "approved") {
            setVacationDaysLeft((prev) => prev + 1);
        }
        if (newType === "vacaciones" && updated.status === "approved") {
            setVacationDaysLeft((prev) => prev - 1);
        }
        setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? updated : e)));

        // Enviamos al backend (sin esperar respuesta)
        fetch(`${API_BASE_URL}/calendar/events/${editingEvent.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user!.token}`,
            },
            body: JSON.stringify({ type: newType, status: updated.status }),
        })
            .then((r) => {
                if (!r.ok) console.error("Error al actualizar tipo");
            })
            .catch((err) => console.error("Error de red", err));

        // Cerramos modal sin esperar
        setEditingEvent(null);
    };

    // Crear evento (único día)
    const createEvent = (type: EventType) => {
        if (!selectedDay) return;

        // PROTECCIÓN: no permitir doble vacación el mismo día
        const existingVacations = events.filter((e) => e.date === selectedDay && e.type === "vacaciones");
        if (type === "vacaciones" && existingVacations.length > 0) {
            alert("Ya existe un evento de vacaciones este día");
            return;
        }
        if (type === "vacaciones" && vacationDaysLeft <= 0) {
            alert("No te quedan días de vacaciones");
            return;
        }

        const body: any = {
            type,
            date: selectedDay,
            visibility,
            viewers: visibility === "some" ? viewers : undefined,
        };

        // ✅ IMPORTANTE: Agregar status para vacaciones
        if (type === "vacaciones") {
            body.status = "pending";
        }

        if (type === "cita médica" && medicalFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                body.medicalJustificationDataUrl = reader.result as string;
                sendEvent(body);
                setMedicalFile(null);
            };
            reader.readAsDataURL(medicalFile);
        } else {
            sendEvent(body);
        }
        setSelectedDay(null);
    };

    // Borrar evento
    const handleDeleteEvent = (ev: CalendarEvent) => {
        // Eliminamos localmente
        setEvents((prev) => prev.filter((e) => e.id !== ev.id));

        // Si era vacación (pending o approved), devolvemos el día
        if (ev.type === "vacaciones") {
            setVacationDaysLeft((prev) => prev + 1);
            console.log("🔄 Devolviendo 1 día de vacaciones");
        }

        // Enviamos al backend sin esperar
        fetch(`${API_BASE_URL}/calendar/events/${ev.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user!.token}` },
        })
            .then((r) => {
                if (!r.ok) console.error("Error al eliminar");
            })
            .catch((err) => console.error("Error de red", err));

        setEditingEvent(null);
    };

    // Vista mensual dinámica
    const monthDays = Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => i + 1);
    const monthName = new Date(currentYear, currentMonth).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
            {/* Header */}
            <header style={{
                backgroundColor: "#ffffff",
                padding: "0.75rem 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}>
                <div>
                    <div style={{ fontSize: "1rem", fontWeight: 600 }}>Mi Calendario</div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                        Usuario: <strong>{user?.email}</strong> ({user?.fullName})
                    </div>
                </div>
                <button
                    onClick={() => navigate("/perfil")}
                    style={{
                        fontSize: "0.8rem",
                        color: "#2563eb",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    Volver al área personal
                </button>
            </header>

            {/* Main */}
            <main style={{ maxWidth: 1180, margin: "0 auto", padding: "1.5rem 0.5rem 2rem" }}>
                {/* Selector de mes */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <button
                            onClick={handlePrevMonth}
                            style={{
                                padding: "0.2rem 0.5rem",
                                fontSize: "0.8rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #d1d5db",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                            }}
                        >
                            ◀
                        </button>
                        <span style={{
                            fontSize: "1rem",
                            fontWeight: 600,
                            textTransform: "capitalize",
                        }}>
                            {monthName}
                        </span>
                        <button
                            onClick={handleNextMonth}
                            style={{
                                padding: "0.2rem 0.5rem",
                                fontSize: "0.8rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #d1d5db",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                            }}
                        >
                            ▶
                        </button>
                    </div>

                    {/* Días de vacaciones restantes */}
                    <div style={{ fontSize: "0.8rem", color: "#374151" }}>
                        Días de vacaciones restantes: <strong>{vacationDaysLeft}</strong>
                    </div>
                </div>

                {/* Modo selección fin */}
                {vacationMode && (
                    <div style={{
                        marginBottom: "1rem",
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "#dcfce7",
                        border: "1px solid #86efac",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        color: "#166534",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <span>Selecciona el último día de vacaciones (inicio: {vacationMode}) → click en el calendario</span>
                        <button
                            onClick={() => setVacationMode(null)}
                            style={{
                                padding: "0.2rem 0.5rem",
                                fontSize: "0.75rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #166534",
                                backgroundColor: "#ffffff",
                                color: "#166534",
                                cursor: "pointer",
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                )}

                {/* Calendario visual */}
                <div style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "0.5rem",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
                    padding: "1rem",
                }}>
                    {/* Cabecera días de la semana */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "0.5rem",
                        textAlign: "center",
                        marginBottom: "0.5rem",
                    }}>
                        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                            <div key={d} style={{
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                color: "#4b5563",
                                padding: "0.25rem",
                            }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Días del mes */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                        gap: "0.5rem",
                        textAlign: "center",
                    }}>
                        {monthDays.map((day) => {
                            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dayEvents = events.filter((e) => {
                                // IMPORTANTE: Asegúrate de que e.date esté en formato YYYY-MM-DD
                                return e.date === dateStr;
                            });
                            const weekend = isWeekend(dateStr);
                            const future = isFutureDay(dateStr);

                            let bg = "#fff"; // valor por defecto

                            // 1. Vacaciones (tienen prioridad sobre futuro y fin de semana)
                            const vacPending = dayEvents.some((e) => e.type === "vacaciones" && e.status === "pending");
                            const vacApproved = dayEvents.some((e) => e.type === "vacaciones" && e.status === "approved");

                            if (vacApproved) {
                                bg = "#bfdbfe";       // AZUL vacaciones aprobadas
                            } else if (vacPending) {
                                bg = "#fed7aa";       // NARANJA vacaciones pendientes
                            } else if (weekend) {
                                bg = "#fef3c7";       // AMARILLO fines de semana
                            } else {
                                const types = dayEvents.map((e) => e.type) as EventType[];
                                if (types.length) {
                                    bg = colorByType[types[0]]; // color del primer evento
                                } else if (future) {
                                    bg = "#e5e7eb";     // GRIS sólo si es futuro y sin eventos
                                }
                            }

                            return (
                                <div
                                    key={day}
                                    onClick={() => handleDayClick(day)}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "0.25rem",
                                        padding: "0.35rem",
                                        minHeight: 70,
                                        backgroundColor: bg,
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <div style={{ fontSize: "0.75rem", fontWeight: "bold", marginBottom: "0.25rem" }}>
                                        {day}
                                    </div>
                                    {dayEvents.map((ev) => (
                                        <button
                                            key={ev.id}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditEvent(ev);
                                            }}
                                            style={{
                                                fontSize: "0.65rem",
                                                marginTop: "0.15rem",
                                                padding: "0.1rem 0.3rem",
                                                border: "1px solid #d1d5db",
                                                borderRadius: "0.25rem",
                                                background: "#ffffff",
                                                cursor: "pointer",
                                                color: "#000",
                                                width: "100%",
                                                textAlign: "left",
                                            }}
                                            title="Click para editar o borrar"
                                        >
                                            {ev.type}
                                            {ev.type === "vacaciones" && ev.status === "pending" && (
                                                <span title="Pendiente de aprobación"> ⏳</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Leyenda */}
                <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#4b5563" }}>
                    <div>
                        <span style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: "#fef3c7",
                            border: "1px solid #e5e7eb",
                            marginRight: "0.25rem",
                            verticalAlign: "middle",
                        }} />
                        Fines de semana
                    </div>
                    <div style={{ marginTop: "0.15rem" }}>
                        <span style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: "#e5e7eb",
                            border: "1px solid #d1d5db",
                            marginRight: "0.25rem",
                            verticalAlign: "middle",
                        }} />
                        Días futuros
                    </div>
                    <div style={{ marginTop: "0.15rem" }}>
                        <span style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: "#bfdbfe",
                            border: "1px solid #60a5fa",
                            marginRight: "0.25rem",
                            verticalAlign: "middle",
                        }} />
                        Vacaciones aprobadas
                    </div>
                    <div style={{ marginTop: "0.15rem" }}>
                        <span style={{
                            display: "inline-block",
                            width: "12px",
                            height: "12px",
                            backgroundColor: "#fed7aa",
                            border: "1px solid #fb923c",
                            marginRight: "0.25rem",
                            verticalAlign: "middle",
                        }} />
                        Vacaciones pendientes
                    </div>
                </div>
            </main>

            {/* Modal ligero para editar/borrar */}
            {editingEvent && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 999,
                    }}
                    onClick={() => setEditingEvent(null)}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            padding: "1.5rem",
                            borderRadius: "0.5rem",
                            width: 320,
                            maxHeight: 400,
                            overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>Editar evento del {editingEvent.date}</h4>
                        <div style={{ marginBottom: "1rem" }}>
                            <label>
                                Tipo:
                                <select
                                    value={editingEvent.type}
                                    onChange={(e) => handleUpdateType(e.target.value as EventType)}
                                    style={{ width: "100%", marginTop: "0.25rem", padding: "0.35rem" }}
                                >
                                    {(["visita", "juicio", "vacaciones", "cita médica", "citación judicial", "otros"] as EventType[]).map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                                onClick={() => setEditingEvent(null)}
                                style={{
                                    flex: 1,
                                    padding: "0.4rem",
                                    borderRadius: "0.25rem",
                                    border: "1px solid #d1d5db",
                                    backgroundColor: "#ffffff",
                                    cursor: "pointer",
                                }}
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => handleDeleteEvent(editingEvent)}
                                style={{
                                    flex: 1,
                                    padding: "0.4rem",
                                    borderRadius: "0.25rem",
                                    backgroundColor: "#fee2e2",
                                    color: "#b91c1c",
                                    border: "1px solid #fca5a5",
                                    cursor: "pointer",
                                }}
                            >
                                Borrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Menú rápido al clicar día */}
            {selectedDay && !vacationMode && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 999,
                    }}
                    onClick={() => setSelectedDay(null)}
                >
                    <div
                        style={{
                            backgroundColor: "#fff",
                            padding: "1.5rem",
                            borderRadius: "0.5rem",
                            width: 400,
                            maxHeight: 500,
                            overflowY: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>Evento para el {selectedDay}</h4>

                        {/* Selector de tipo */}
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                                Tipo de evento:
                            </label>
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                {(["visita", "juicio", "vacaciones", "cita médica", "otros"] as EventType[]).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            if (t === "vacaciones") {
                                                setVacationMode(selectedDay);
                                                setSelectedDay(null);
                                            } else {
                                                createEvent(t);
                                            }
                                        }}
                                        style={{
                                            padding: "0.4rem 0.8rem",
                                            fontSize: "0.8rem",
                                            borderRadius: "0.25rem",
                                            border: "1px solid #d1d5db",
                                            backgroundColor: "#ffffff",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Visibilidad */}
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                                ¿Quién puede ver este evento?
                            </label>
                            <select
                                value={visibility}
                                onChange={(e) => setVisibility(e.target.value as Visibility)}
                                style={{ width: "100%", padding: "0.35rem" }}
                            >
                                <option value="only-me">Solo yo</option>
                                <option value="all">Todos</option>
                                <option value="some">Personas concretas</option>
                            </select>
                            {visibility === "some" && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                                    {users.map((u) => (
                                        <label key={u.id} style={{ fontSize: "0.8rem" }}>
                                            <input
                                                type="checkbox"
                                                checked={viewers.includes(u.id)}
                                                onChange={(e) =>
                                                    setViewers((prev) =>
                                                        e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                                                    )
                                                }
                                            />
                                            {u.fullName}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Justificante médico */}
                        <div style={{ marginBottom: "1rem" }}>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
                                Justificante para cita médica (opcional):
                            </label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => setMedicalFile(e.target.files?.[0] ?? null)}
                                style={{ fontSize: "0.8rem" }}
                            />
                        </div>

                        <button
                            onClick={() => setSelectedDay(null)}
                            style={{
                                width: "100%",
                                padding: "0.5rem",
                                borderRadius: "0.25rem",
                                border: "1px solid #d1d5db",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                            }}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // Enviar rango de vacaciones sin problemas de zona horaria
    async function createVacationRangeFromTo(start: string, end: string) {
        // start y end vienen como 'YYYY-MM-DD'
        const [sy, sm, sd] = start.split("-").map(Number);
        const [ey, em, ed] = end.split("-").map(Number);

        // Función auxiliar para saber días de un mes
        const daysInMonth = (y: number, m: number) => {
            const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
            const table = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            return table[m - 1];
        };

        // Compara fecha (y,m,d)
        const isAfter = (y1: number, m1: number, d1: number, y2: number, m2: number, d2: number) => {
            if (y1 > y2) return true;
            if (y1 < y2) return false;
            if (m1 > m2) return true;
            if (m1 < m2) return false;
            return d1 > d2;
        };

        // Calculamos número de días sin usar Date
        let y = sy, m = sm, d = sd;
        let count = 0;
        while (!isAfter(y, m, d, ey, em, ed)) {
            count++;
            d++;
            if (d > daysInMonth(y, m)) {
                d = 1;
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
        }

        if (count > vacationDaysLeft) {
            alert(`Solo te quedan ${vacationDaysLeft} días de vacaciones`);
            return;
        }

        // Volvemos al inicio y generamos todas las fechas como strings
        const dates: string[] = [];
        y = sy; m = sm; d = sd;
        while (!isAfter(y, m, d, ey, em, ed)) {
            const yyyy = String(y);
            const mm = String(m).padStart(2, "0");
            const dd = String(d).padStart(2, "0");
            dates.push(`${yyyy}-${mm}-${dd}`);

            d++;
            if (d > daysInMonth(y, m)) {
                d = 1;
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }
        }

        const newEvents: CalendarEvent[] = [];
        let successCount = 0;

        for (const date of dates) {
            try {
                const response = await fetch(`${API_BASE_URL}/calendar/events`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${user!.token}`,
                    },
                    body: JSON.stringify({
                        type: "vacaciones",
                        date,
                        status: "pending",
                        visibility,
                        viewers: visibility === "some" ? viewers : undefined,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error(`Error en ${date}:`, error.error);
                    continue; // Continúa con el siguiente día
                }

                const event = await response.json();
                newEvents.push(event);
                successCount++;

            } catch (err) {
                console.error(`Error de red en ${date}:`, err);
                continue;
            }
        }

        // Actualiza el estado solo con los eventos creados exitosamente
        if (newEvents.length > 0) {
            setEvents(prev => [...prev, ...newEvents]);
            setVacationDaysLeft(prev => prev - successCount);
            alert(`✅ ${successCount} días de vacaciones creados`);
        }
    }

    // Envío simple
    function sendEvent(body: any) {
        fetch(`${API_BASE_URL}/calendar/events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user!.token}`,
            },
            body: JSON.stringify(body),
        })
            .then((r) => r.json())
            .then((ev: CalendarEvent) => {
                setEvents([...events, ev]);
                if (body.type === "vacaciones" && body.status === "approved") {
                    setVacationDaysLeft((prev) => prev - 1);
                }
            })
            .catch(() => alert("Error al guardar"));
    }
};

export default CalendarPage;