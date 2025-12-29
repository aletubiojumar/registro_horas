import React, { useEffect, useState } from "react";
import type { AdminUser } from "./UserList";

type DocType = "payroll" | "contract" | "citation";

type Theme = {
  pageBg: string;
  rightBg: string;
  leftBg: string;
  border: string;
  text: string;
  muted: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  dangerBg: string;
  dangerText: string;
  primary: string;
};

interface Props {
  user: AdminUser;
  token: string;
  theme: Theme;
}

// Tipado suave, por si el backend cambia campos
type Citation = {
  id: string;
  title?: string;
  issuedAt?: string;
  status?: "pending" | "accepted" | "rejected" | string;
};

type Payroll = {
  id: string;
  month: string;
  year: string;
};

type Contract = {
  fileName?: string;
};

// // ✅ siempre con slash delante
// export const API = import.meta.env.VITE_API_URL ?? "/api";

const AdminDocumentsManager: React.FC<Props> = ({ user, token, theme }) => {
  const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);

  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  // OJO: se reutiliza para los 3 inputs (como ya venía). Mantenemos el patrón.
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const payrollInputRef = React.useRef<HTMLInputElement>(null);
  const contractInputRef = React.useRef<HTMLInputElement>(null);
  const citationInputRef = React.useRef<HTMLInputElement>(null);

  // Estados para nóminas
  const [payrollSearch, setPayrollSearch] = useState("");
  const [showAllPayrolls, setShowAllPayrolls] = useState(false);
  const PAYROLLS_LIMIT = 4;

  // Estados para citaciones
  const [citationSearch, setCitationSearch] = useState("");
  const [showAllCitations, setShowAllCitations] = useState(false);
  const CITATIONS_LIMIT = 4;

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API, token, user.id]);

  const loadDocuments = () => {
    console.log('🔄 Cargando documentos para usuario:', user.id);
    
    fetch(`${API}/admin/documents/payrolls?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        console.log('📥 Respuesta payrolls:', r.status);
        return r.json();
      })
      .then((d) => {
        console.log('✅ Payrolls cargadas:', d.payrolls);
        setPayrolls(d.payrolls || []);
      })
      .catch((err) => {
        console.error('❌ Error cargando payrolls:', err);
        setPayrolls([]);
      });

    fetch(`${API}/admin/documents/citations?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        console.log('📥 Respuesta citations:', r.status, r.ok);
        if (!r.ok) {
          return r.text().then(text => {
            console.error('❌ Error del servidor:', text);
            throw new Error(`HTTP ${r.status}: ${text}`);
          });
        }
        return r.json();
      })
      .then((d) => {
        console.log('✅ Citations recibidas:', d);
        console.log('✅ Array de citations:', d.citations);
        setCitations(d.citations || []);
      })
      .catch((err) => {
        console.error('❌ Error cargando citations:', err);
        setCitations([]);
      });

    fetch(`${API}/admin/documents/contract?userId=${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setContract(d.contract || null))
      .catch(() => setContract(null));
  };

  const safeJson = async (r: Response) => {
    const text = await r.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { error: text || "Error" };
    }
  };

  const titleFromFilename = (f: File) => {
    const name = f.name || "Citación";
    return name.replace(/\.[^.]+$/, "").trim() || "Citación";
  };

  const handleUpload = (type: DocType) => {
    if (!file) {
      alert("Por favor, selecciona un archivo");
      return;
    }

    setUploading(true);

    const form = new FormData();
    form.append("file", file);
    form.append("ownerId", user.id);

    if (type === "payroll") {
      form.append("month", String(month).padStart(2, "0"));
      form.append("year", String(year));
    }

    if (type === "citation") {
      // ✅ sin prompt: título automático
      form.append("title", titleFromFilename(file));
      // mantenemos el formato yyyy-mm-dd que ya usabas
      form.append("issuedAt", new Date().toISOString().slice(0, 10));
    }

    fetch(`${API}/admin/documents/${type}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
      .then(async (r) => {
        if (!r.ok) {
          const error = await safeJson(r);
          throw new Error(error.error || "Error al subir");
        }
        return safeJson(r);
      })
      .then(() => {
        alert("✅ Documento subido correctamente");
        setFile(null);
        if (payrollInputRef.current) payrollInputRef.current.value = "";
        if (contractInputRef.current) contractInputRef.current.value = "";
        if (citationInputRef.current) citationInputRef.current.value = "";
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
        ? `${API}/admin/documents/contract/download?userId=${user.id}`
        : `${API}/admin/documents/${type}s/${id}/download`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Error al descargar");
        return r.blob();
      })
      .then((blob) => {
        const fileName =
          type === "contract" ? `contrato_${user.id}.pdf` : `${type}_${id}.pdf`;
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

  // Filtrar y ordenar nóminas
  const getFilteredPayrolls = () => {
    let filtered = [...payrolls];

    // Filtrar por búsqueda
    if (payrollSearch.trim()) {
      const searchLower = payrollSearch.toLowerCase();
      filtered = filtered.filter((p) => {
        const dateStr = new Date(`${p.year}-${p.month}-01`).toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        });
        return dateStr.toLowerCase().includes(searchLower);
      });
    }

    // Ordenar por fecha (más reciente primero)
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.year}-${a.month}-01`).getTime();
      const dateB = new Date(`${b.year}-${b.month}-01`).getTime();
      return dateB - dateA;
    });

    // Limitar cantidad si no se muestran todas
    if (!showAllPayrolls) {
      filtered = filtered.slice(0, PAYROLLS_LIMIT);
    }

    return filtered;
  };

  // Filtrar y ordenar citaciones
  const getFilteredCitations = () => {
    let filtered = [...citations];

    // Filtrar por búsqueda (título o fecha)
    if (citationSearch.trim()) {
      const searchLower = citationSearch.toLowerCase();
      filtered = filtered.filter((c) => {
        const titleMatch = (c.title || "").toLowerCase().includes(searchLower);
        const dateMatch = c.issuedAt
          ? new Date(c.issuedAt).toLocaleDateString("es-ES").toLowerCase().includes(searchLower)
          : false;
        return titleMatch || dateMatch;
      });
    }

    // Ordenar por fecha (más reciente primero)
    filtered.sort((a, b) => {
      const dateA = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
      const dateB = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Limitar cantidad si no se muestran todas
    if (!showAllCitations) {
      filtered = filtered.slice(0, CITATIONS_LIMIT);
    }

    return filtered;
  };

  const filteredPayrolls = getFilteredPayrolls();
  const filteredCitations = getFilteredCitations();
  const hasMorePayrolls = payrolls.length > PAYROLLS_LIMIT;
  const hasMoreCitations = citations.length > CITATIONS_LIMIT;

  // Debug: mostrar estado actual
  console.log('📊 Estado actual:', {
    totalCitations: citations.length,
    filteredCitations: filteredCitations.length,
    citationSearch,
    showAllCitations,
    citations: citations,
  });

  const sectionStyle: React.CSSProperties = {
    border: `1px solid ${theme.border}`,
    borderRadius: "0.5rem",
    padding: "1.5rem",
    backgroundColor: theme.cardBg,
    color: theme.text,
  };

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${theme.inputBorder}`,
    backgroundColor: theme.inputBg,
    color: theme.text,
    borderRadius: "0.25rem",
    padding: "0.4rem",
    outline: "none",
  };

  const smallBtn = (bg: string, border: string, color: string): React.CSSProperties => ({
    padding: "0.2rem 0.5rem",
    fontSize: "0.75rem",
    borderRadius: "0.25rem",
    border: `1px solid ${border}`,
    backgroundColor: bg,
    color,
    cursor: "pointer",
  });

  const statusLabel = (s?: string) => {
    if (s === "accepted") return { text: "Aceptada", bg: "#dcfce7", color: "#166534" };
    if (s === "rejected") return { text: "Rechazada", bg: "#fee2e2", color: "#991b1b" };
    return { text: "Pendiente", bg: "#e5e7eb", color: "#374151" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* NÓMINAS */}
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Nóminas</h3>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
          <input
            ref={payrollInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ flex: 1, color: theme.text }}
          />

          <select value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle}>
            <option value="">Selecciona mes</option>
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
            min={2020}
            max={2030}
            style={{ ...inputStyle, width: 90 }}
          />

          <button
            onClick={() => handleUpload("payroll")}
            disabled={!file || !month || uploading}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "0.25rem",
              border: `1px solid ${theme.primary}`,
              backgroundColor: theme.primary,
              color: "#fff",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Subiendo..." : "Subir nómina"}
          </button>
        </div>

        {/* Barra de búsqueda de nóminas */}
        {payrolls.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              type="text"
              placeholder="Buscar por mes/año..."
              value={payrollSearch}
              onChange={(e) => {
                setPayrollSearch(e.target.value);
                setShowAllPayrolls(false);
              }}
              style={{
                width: "100%",
                padding: "0.4rem",
                borderRadius: "0.25rem",
                border: `1px solid ${theme.inputBorder}`,
                backgroundColor: theme.inputBg,
                color: theme.text,
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>
        )}

        {filteredPayrolls.length > 0 ? (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredPayrolls.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.4rem 0",
                    borderBottom: `1px solid ${theme.border}`,
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
                      style={smallBtn(theme.inputBg, theme.inputBorder, theme.text)}
                    >
                      Descargar
                    </button>
                    <button
                      onClick={() => handleDelete("payroll", p.id)}
                      style={smallBtn(theme.dangerBg, theme.dangerText, theme.dangerText)}
                    >
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {hasMorePayrolls && !payrollSearch && (
              <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <button
                  onClick={() => setShowAllPayrolls(!showAllPayrolls)}
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.8rem",
                    borderRadius: "0.25rem",
                    border: `1px solid ${theme.inputBorder}`,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    cursor: "pointer",
                  }}
                >
                  {showAllPayrolls ? "Ver menos" : `Ver todas (${payrolls.length})`}
                </button>
              </div>
            )}
          </>
        ) : payrolls.length > 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: theme.muted }}>
            No se encontraron nóminas que coincidan con "{payrollSearch}".
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "0.85rem", color: theme.muted }}>
            No hay nóminas subidas.
          </p>
        )}
      </section>

      {/* CONTRATO */}
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Contrato</h3>

        {contract ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.6rem",
              border: `1px solid ${theme.border}`,
              borderRadius: "0.25rem",
              backgroundColor: theme.inputBg,
            }}
          >
            <span style={{ fontSize: "0.85rem" }}>{contract.fileName}</span>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleDownload("contract")}
                style={smallBtn(theme.inputBg, theme.inputBorder, theme.text)}
              >
                Descargar
              </button>
              <button
                onClick={() => handleDelete("contract")}
                style={smallBtn(theme.dangerBg, theme.dangerText, theme.dangerText)}
              >
                Borrar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              ref={contractInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ flex: 1, color: theme.text }}
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
      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Citaciones</h3>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
          <input
            ref={citationInputRef}
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ flex: 1, color: theme.text }}
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

        {/* Barra de búsqueda de citaciones */}
        {citations.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              type="text"
              placeholder="Buscar por título o fecha..."
              value={citationSearch}
              onChange={(e) => {
                setCitationSearch(e.target.value);
                setShowAllCitations(false);
              }}
              style={{
                width: "100%",
                padding: "0.4rem",
                borderRadius: "0.25rem",
                border: `1px solid ${theme.inputBorder}`,
                backgroundColor: theme.inputBg,
                color: theme.text,
                fontSize: "0.875rem",
                outline: "none",
              }}
            />
          </div>
        )}

        {filteredCitations.length > 0 ? (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredCitations.map((c) => {
                const st = statusLabel(c.status);
                return (
                  <li
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.4rem 0",
                      borderBottom: `1px solid ${theme.border}`,
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.title || "Citación"}
                        </div>

                        {/* ✅ Badge estado */}
                        <span
                          style={{
                            padding: "0.15rem 0.45rem",
                            borderRadius: 999,
                            background: st.bg,
                            color: st.color,
                            fontSize: "0.75rem",
                            whiteSpace: "nowrap",
                          }}
                          title={`Estado: ${st.text}`}
                        >
                          {st.text}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.75rem", color: theme.muted }}>
                        {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString("es-ES") : "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button
                        onClick={() => handleDownload("citation", c.id)}
                        style={smallBtn(theme.inputBg, theme.inputBorder, theme.text)}
                      >
                        Descargar
                      </button>
                      <button
                        onClick={() => handleDelete("citation", c.id)}
                        style={smallBtn(theme.dangerBg, theme.dangerText, theme.dangerText)}
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMoreCitations && !citationSearch && (
              <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <button
                  onClick={() => setShowAllCitations(!showAllCitations)}
                  style={{
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.8rem",
                    borderRadius: "0.25rem",
                    border: `1px solid ${theme.inputBorder}`,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    cursor: "pointer",
                  }}
                >
                  {showAllCitations ? "Ver menos" : `Ver todas (${citations.length})`}
                </button>
              </div>
            )}
          </>
        ) : citations.length > 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: theme.muted }}>
            No se encontraron citaciones que coincidan con "{citationSearch}".
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "0.85rem", color: theme.muted }}>
            No hay citaciones subidas.
          </p>
        )}
      </section>
    </div>
  );
};

export default AdminDocumentsManager;