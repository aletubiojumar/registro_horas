import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type User = {
  id: string;
  fullName: string;
  // add other fields if needed
};

interface AdminHoursViewerProps {
  user: User;
}

export default function AdminHoursViewer({ user: selectedUser }: AdminHoursViewerProps) {
  const { user: admin } = useAuth();

  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(1);
  const [data, setData] = useState<any>(null);

  const loadHours = () => {
    fetch(
      `http://localhost:4000/api/admin/hours?userId=${selectedUser.id}&year=${year}&month=${month}`,
      {
        headers: {
          Authorization: `Bearer ${admin?.token}`,
        },
      }
    )
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch((err) => console.error(err));
  };

  const downloadPdf = () => {
    window.open(
      `http://localhost:4000/api/admin/hours/pdf?userId=${selectedUser.id}&year=${year}&month=${month}&token=${admin?.token}`,
      "_blank"
    );
  };

  return (
    <div>
      <h2>Horas de: {selectedUser.fullName}</h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Año:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>

        <label>
          Mes:
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            min={1}
            max={12}
          />
        </label>

        <button onClick={loadHours}>Cargar</button>
        <button onClick={downloadPdf}>Descargar PDF</button>
      </div>

      <pre>{data ? JSON.stringify(data, null, 2) : "Sin datos cargados..."}</pre>
    </div>
  );
}
