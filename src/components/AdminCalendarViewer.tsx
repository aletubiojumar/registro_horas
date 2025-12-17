import React, { useEffect, useState } from "react";
import { CalendarPageCore } from "../components/CalendarPageCore";
import type { AdminUser } from "./UserList";

type Theme = {
  border: string;
  text: string;
  muted: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
};

const AdminCalendarViewer: React.FC<{
  user: AdminUser;
  token: string;
  theme: Theme;
}> = ({ user, token, theme }) => {
  const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
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
    <div style={{ color: theme.text }}>
      <h3>Calendario de {user.fullName}</h3>

      {/* Wrapper que “oscurece” el área del calendario */}
      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: "0.75rem",
          padding: "0.75rem",
          backgroundColor: theme.cardBg,
        }}
      >
        <CalendarPageCore
          events={events}
          readOnly
          onApproveVacation={handleApprove}
        />
      </div>
    </div>
  );
};

export default AdminCalendarViewer;
