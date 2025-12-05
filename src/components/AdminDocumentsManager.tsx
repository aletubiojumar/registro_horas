import React, { useEffect, useState } from "react";
import type { AdminUser } from "./UserList";

type DocType = "payroll" | "contract" | "citation";

const AdminDocumentsManager: React.FC<{
  user: AdminUser;
  token: string;
}> = ({ user, token }) => {
  const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [citations, setCitations] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);

  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // listados iniciales
    fetch(`${API}/documents/payrolls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPayrolls(d.payrolls || []));
    fetch(`${API}/documents/citations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCitations(d.citations || []));
    fetch(`${API}/documents/contract`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setContract(d.contract || null));
  }, [API, token]);

  const handleUpload = (type: DocType) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("ownerId", user.id);
    if (type === "payroll") {
      form.append("month", String(month).padStart(2, "0"));
      form.append("year", String(year));
    }
    if (type === "citation") {
      form.append("title", prompt("Título de la citación:") || "Citación");
      form.append("issuedAt", new Date().toISOString().slice(0, 10));
    }

    fetch(`${API}/admin/documents/${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
      .then((r) => r.json())
      .then(() => {
        alert("Subida ok");
        setFile(null);
        // recargar listas
        if (type === "payroll")
          fetch(`${API}/documents/payrolls`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((d) => setPayrolls(d.payrolls || []));
        if (type === "citation")
          fetch(`${API}/documents/citations`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((d) => setCitations(d.citations || []));
        if (type === "contract")
          fetch(`${API}/documents/contract`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then((d) => setContract(d.contract || null));
      })
      .catch(() => alert("Error al subir"))
      .finally(() => setUploading(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* NÓMINAS */}
      <section>
        <h3>Nóminas</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i, 1).toLocaleDateString("es-ES", { month: "long" })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min="2020"
            max="2030"
            style={{ width: 80 }}
          />
          <button
            onClick={() => handleUpload("payroll")}
            disabled={!file || !month || uploading}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "0.25rem",
              border: "1px solid #2563eb",
              backgroundColor: "#2563eb",
              color: "#fff",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Subiendo..." : "Subir nómina"}
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {payrolls.map((p) => (
            <li
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <span style={{ fontSize: "0.85rem" }}>
                {new Date(`${p.year}-${p.month}-02`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => {
                  fetch(`${API}/admin/documents/payrolls/${p.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(() =>
                    fetch(`${API}/documents/payrolls`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                      .then((r) => r.json())
                      .then((d) => setPayrolls(d.payrolls || []))
                  );
                }}
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* CONTRATO */}
      <section>
        <h3>Contrato</h3>
        {contract ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem" }}>{contract.fileName}</span>
            <button
              onClick={() => {
                fetch(`${API}/admin/documents/contract`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                }).then(() => setContract(null));
              }}
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.75rem",
                borderRadius: "0.25rem",
                border: "1px solid #d1d5db",
                backgroundColor: "#fff",
                cursor: "pointer",
              }}
            >
              Borrar
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button
              onClick={() => handleUpload("contract")}
              disabled={!file || uploading}
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
        )}
      </section>

      {/* CITACIONES */}
      <section>
        <h3>Citaciones</h3>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            onClick={() => handleUpload("citation")}
            disabled={!file || uploading}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "0.25rem",
              border: "1px solid #7c3aed",
              backgroundColor: "#7c3aed",
              color: "#fff",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Subiendo..." : "Subir citación"}
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {citations.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div>
                <div style={{ fontSize: "0.85rem" }}>{c.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {new Date(c.issuedAt).toLocaleDateString("es-ES")}
                </div>
              </div>
              <button
                onClick={() => {
                  fetch(`${API}/admin/documents/citations/${c.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(() =>
                    fetch(`${API}/documents/citations`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                      .then((r) => r.json())
                      .then((d) => setCitations(d.citations || []))
                  );
                }}
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminDocumentsManager;