import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type Payroll = { id: string; month: string; year: string; fileName: string };
type Citation = { id: string; title: string; issuedAt: string; fileName: string };

const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const nav = useNavigate();

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [contract, setContract] = useState<{ fileName: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [uploading, setUploading] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);

  const contractInputRef = React.useRef<HTMLInputElement>(null);

  // Cargar documentos
  useEffect(() => {
    if (!user) return;
    loadDocuments();
  }, [user]);

  const loadDocuments = () => {
    if (!user?.token) return;

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
  };

  const handleUploadContract = () => {
    if (!contractFile || !user?.token) {
      alert("Por favor, selecciona un archivo");
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", contractFile);
    // Para trabajadores, el ownerId es su propio ID
    form.append("ownerId", user.id);

    console.log("📡 Trabajador subiendo contrato:", {
      ownerId: user.id,
      fileName: contractFile.name,
    });

    fetch(`${API_BASE_URL}/documents/contract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
      body: form,
    })
      .then(async (r) => {
        if (!r.ok) {
          const error = await r.json();
          throw new Error(error.error || "Error al subir contrato");
        }
        return r.json();
      })
      .then(() => {
        alert("✅ Contrato subido correctamente");
        setContractFile(null);
        if (contractInputRef.current) contractInputRef.current.value = "";
        loadDocuments(); // Recargar documentos
      })
      .catch((err) => {
        console.error("❌ Error al subir contrato:", err);
        alert(`Error: ${err.message}`);
      })
      .finally(() => setUploading(false));
  };

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    return new Date(+y, +mm - 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  };

  const handleDownload = (
    type: "payroll" | "contract" | "citation",
    id?: string
  ) => {
    const url =
      type === "contract"
        ? `${API_BASE_URL}/documents/contract/download`
        : `${API_BASE_URL}/documents/${type}s/${id}/download`;

    fetch(url, { headers: { Authorization: `Bearer ${user!.token}` } })
      .then((res) => {
        if (!res.ok) throw new Error("Error al descargar");
        return res.blob();
      })
      .then((blob) => {
        const fileName =
          type === "contract"
            ? `contrato_${user!.id}.pdf`
            : `${type}_${id}.pdf`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      })
      .catch(() => alert("Error al descargar"));
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#ffffff",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
      >
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
        <section
          style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
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
                const p = payrolls.find(
                  (x) => x.year === year && x.month === month
                )!;
                handleDownload("payroll", p.id);
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
        <section
          style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            padding: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Contrato</h3>
          {contract ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{contract.fileName}</span>
              <button
                onClick={() => handleDownload("contract")}
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
            </div>
          ) : (
            <div>
              <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
                No tienes contrato subido. Puedes subirlo aquí:
              </p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  ref={contractInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleUploadContract}
                  disabled={!contractFile || uploading}
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #059669",
                    backgroundColor: "#059669",
                    color: "#fff",
                    cursor: uploading ? "not-allowed" : "pointer",
                    opacity: uploading ? 0.6 : 1,
                  }}
                >
                  {uploading ? "Subiendo..." : "Subir contrato"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* CITACIONES */}
        <section
          style={{
            backgroundColor: "#fff",
            borderRadius: "0.5rem",
            padding: "1.5rem",
          }}
        >
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
                    onClick={() => handleDownload("citation", c.id)}
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
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
              No hay citaciones.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default DocumentsPage;