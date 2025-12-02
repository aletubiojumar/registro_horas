import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type Payroll = { id: string; month: string; year: string; fileName: string }; // 2025-12
type Citation = { id: string; title: string; issuedAt: string; fileName: string };

const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const nav = useNavigate();

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [contract, setContract] = useState<{ fileName: string } | null>(null);

  const [selectedMonth, setSelectedMonth] = useState("");

  // Cargar listados
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch(`${API_BASE_URL}/documents/payrolls`, {
        headers: { Authorization: `Bearer ${user.token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`${API_BASE_URL}/documents/contract`, {
        headers: { Authorization: `Bearer ${user.token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`${API_BASE_URL}/documents/citations`, {
        headers: { Authorization: `Bearer ${user.token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject())),
    ])
      .then(([pay, con, cit]) => {
        setPayrolls(pay.payrolls || []);
        setContract(con.contract || null);
        setCitations(cit.citations || []);
      })
      .catch(() => alert("Error al cargar documentos"));
  }, [user]);

  // Helpers descarga
  const download = (url: string, fileName: string) => {
    fetch(url, { headers: { Authorization: `Bearer ${user!.token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      })
      .catch(() => alert("Error al descargar"));
  };

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    return new Date(+y, +mm - 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      {/* Header igual que área personal */}
      <header style={{
        backgroundColor: "#ffffff",
        padding: "0.75rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>Mis Documentos</div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Usuario: <strong>{user?.username}</strong> ({user?.fullName})
          </div>
        </div>
        <button
          onClick={() => nav("/perfil")}
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

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "2rem 1rem" }}>
        {/* NÓMINAS */}
        <section style={{ backgroundColor: "#fff", borderRadius: "0.5rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>Nóminas</h3>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: "0.4rem", borderRadius: "0.25rem", border: "1px solid #d1d5db" }}
            >
              <option value="">Selecciona mes</option>
              {payrolls.map((p) => (
                <option key={p.id} value={`${p.year}-${p.month}`}>
                  {monthLabel(`${p.year}-${p.month}`)}
                </option>
              ))}
            </select>
            <button
              disabled={!selectedMonth}
              onClick={() => {
                const [year, month] = selectedMonth.split("-");
                const p = payrolls.find((x) => x.year === year && x.month === month)!;
                download(`${API_BASE_URL}/documents/payrolls/${p.id}/download`, p.fileName);
              }}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.25rem",
                border: "1px solid #2563eb",
                backgroundColor: "#2563eb",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Descargar
            </button>
          </div>
        </section>

        {/* CONTRATO */}
        <section style={{ backgroundColor: "#fff", borderRadius: "0.5rem", padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>Contrato</h3>
          {contract ? (
            <button
              onClick={() => download(`${API_BASE_URL}/documents/contract/download`, contract.fileName)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.25rem",
                border: "1px solid #059669",
                backgroundColor: "#059669",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Descargar contrato
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>No hay contrato disponible.</p>
          )}
        </section>

        {/* CITACIONES */}
        <section style={{ backgroundColor: "#fff", borderRadius: "0.5rem", padding: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>Citaciones</h3>
          {citations.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {citations.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {new Date(c.issuedAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <button
                    onClick={() => download(`${API_BASE_URL}/documents/citations/${c.id}/download`, c.fileName)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      fontSize: "0.8rem",
                      borderRadius: "0.25rem",
                      border: "1px solid #d1d5db",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Descargar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>No hay citaciones.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default DocumentsPage;