import React, { useEffect, useState } from "react";
import { CalendarPageCore } from "../components/CalendarPageCore"; // reutilizamos la cuadrícula
import type { AdminUser } from "./UserList";

const AdminCalendarViewer: React.FC<{
  user: AdminUser;
  token: string;
}> = ({ user, token }) => {
  const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Traemos TODOS los eventos del trabajador (incluidos los “only-me”)
    fetch(`${API}/admin/calendar/events/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []));
  }, [API, token, user.id]);

  const handleApprove = (id: string, approve: boolean) => {
    fetch(`${API}/admin/calendar/events/${id}/vacation`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: approve ? "approved" : "rejected" }),
    })
      .then(() =>
        fetch(`${API}/admin/calendar/events/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json())
          .then((d) => setEvents(d.events || []))
      )
      .catch(() => alert("Error al actualizar vacación"));
  };

  return (
    <div>
      <h3>Calendario de {user.fullName}</h3>
      <CalendarPageCore
        events={events}
        readOnly
        onApproveVacation={handleApprove}
      />
    </div>
  );
};

export default AdminCalendarViewer;