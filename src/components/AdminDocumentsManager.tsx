import React, { useEffect, useState } from "react";
import type { AdminUser } from "./UserList";

type DocType = "payroll" | "contract" | "citation";

interface Props {
  user: AdminUser;
  token: string;
}

const AdminDocumentsManager: React.FC<Props> = ({ user, token }) => {
  const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [citations, setCitations] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);

  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Refs para inputs de archivo
  const payrollInputRef = React.useRef<HTMLInputElement>(null);
  const contractInputRef = React.useRef<HTMLInputElement>(null);
  const citationInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listados iniciales
    loadDocuments();
  }, [API, token, user.id]);

  const loadDocuments = () => {
    // Cargar nóminas
    fetch(`${API}/documents/payrolls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPayrolls(d.payrolls || []));

    // Cargar citaciones
    fetch(`${API}/documents/citations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCitations(d.citations || []));

    // Cargar contrato del trabajador seleccionado
    fetch(`${API}/admin/documents/contract?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setContract(d.contract || null));
  };

  const handleUpload = (type: DocType) => {
    if (!file) {
      alert("Por favor, selecciona un archivo");
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("ownerId", user.id); // ⬅️ CRÍTICO: ID del trabajador seleccionado

    if (type === "payroll") {
      form.append("month", String(month).padStart(2, "0"));
      form.append("year", String(year));
    }

    if (type === "citation") {
      const title = prompt("Título de la citación:") || "Citación";
      form.append("title", title);
      form.append("issuedAt", new Date().toISOString().slice(0, 10));
    }

    // Log para depuración
    console.log("📡 Subiendo documento:", {
      type,
      ownerId: user.id,
      fileName: file.name,
      url: `${API}/admin/documents/${type}`,
    });

    fetch(`${API}/admin/documents/${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
      .then(async (r) => {
        if (!r.ok) {
          const error = await r.json();
          throw new Error(error.error || "Error al subir");
        }
        return r.json();
      })
      .then(() => {
        alert("✅ Documento subido correctamente");
        setFile(null);
        // Limpiar input file
        if (payrollInputRef.current) payrollInputRef.current.value = "";
        if (contractInputRef.current) contractInputRef.current.value = "";
        if (citationInputRef.current) citationInputRef.current.value = "";
        // Recargar documentos
        loadDocuments();
      })
      .catch((err) => {
        console.error("❌ Error al subir:", err);
        alert(`Error: ${err.message}`);
      })
      .finally(() => setUploading(false));
  };

  const handleDelete = (type: DocType, id?: string) => {
    if (!window.confirm("¿Eliminar este documento?")) return;

    // ⬇️ CORREGIR ESTA LÍNEA - usa user.id (del prop, que es el trabajador seleccionado)
    const url =
      type === "contract"
        ? `${API}/admin/documents/contract?userId=${user.id}`
        : `${API}/admin/documents/${type}s/${id}`;

    fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        alert("✅ Documento eliminado");
        loadDocuments();
      })
      .catch((err) => {
        console.error("❌ Error al eliminar:", err);
        alert("Error al eliminar documento");
      });
  };

  const handleDownload = (type: DocType, id?: string) => {
    const url =
      type === "contract"
        ? `${API}/admin/documents/contract?userId=${user.id}`
        : `${API}/admin/documents/${type}s/${id}`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Error al descargar");
        return r.blob();
      })
      .then((blob) => {
        const fileName =
          type === "contract"
            ? `contrato_${user.id}.pdf`
            : `${type}_${id}.pdf`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
      })
      .catch((err) => {
        console.error("❌ Error al descargar:", err);
        alert("Error al descargar documento");
      });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* NÓMINAS */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          backgroundColor: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Nóminas</h3>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <input
            ref={payrollInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ flex: 1 }}
          />
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={{ padding: "0.4rem" }}
          >
            <option value="">Selecciona mes</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i, 1).toLocaleDateString("es-ES", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min="2020"
            max="2030"
            style={{ width: 80, padding: "0.4rem" }}
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
                {new Date(`${p.year}-${p.month}-02`).toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => handleDownload("payroll", p.id)}
                  style={{
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Descargar
                </button>
                <button
                  onClick={() => handleDelete("payroll", p.id)}
                  style={{
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #fecaca",
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    cursor: "pointer",
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* CONTRATO */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          backgroundColor: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Contrato</h3>
        {contract ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.4rem",
              border: "1px solid #e5e7eb",
              borderRadius: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>{contract.fileName}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleDownload("contract")}
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                Descargar
              </button>
              <button
                onClick={() => handleDelete("contract")}
                style={{
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.75rem",
                  borderRadius: "0.25rem",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  cursor: "pointer",
                }}
              >
                Borrar
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <input
              ref={contractInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ flex: 1 }}
            />
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
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          backgroundColor: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Citaciones</h3>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <input
            ref={citationInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ flex: 1 }}
          />
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
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => handleDownload("citation", c.id)}
                  style={{
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Descargar
                </button>
                <button
                  onClick={() => handleDelete("citation", c.id)}
                  style={{
                    padding: "0.2rem 0.5rem",
                    fontSize: "0.75rem",
                    borderRadius: "0.25rem",
                    border: "1px solid #fecaca",
                    backgroundColor: "#fee2e2",
                    color: "#b91c1c",
                    cursor: "pointer",
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminDocumentsManager;