import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import SignatureModal from "../components/SignatureModal";

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
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

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
        const list: Payroll[] = pay.payrolls || [];
        setPayrolls(list);
        setContract(con.contract || null);
        setCitations(cit.citations || []);

        // Si el mes seleccionado ya no existe, limpiar selección
        if (selectedMonth) {
          const [y, m] = selectedMonth.split("-");
          const found = list.find((x) => x.year === y && x.month === m);
          setSelectedPayrollId(found ? found.id : null);
          if (!found) setSelectedMonth("");
        }
      })
      .catch(() => alert("Error al cargar documentos"));
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const monthLabel = (m: string) => {
    const [y, mm] = m.split("-");
    return new Date(+y, +mm - 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  };

  const handleDownload = (type: "payroll" | "contract" | "citation", id?: string) => {
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

  const signSelectedPayroll = async (signatureDataUrl: string) => {
    if (!user?.token) return;
    if (!selectedPayrollId) {
      alert("Selecciona una nómina primero.");
      return;
    }

    setIsSigning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/documents/payrolls/${selectedPayrollId}/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signatureDataUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Error al firmar");
      }

      alert("✅ Nómina firmada. A partir de ahora se descargará ya firmada.");
      setIsSignatureModalOpen(false);
      loadDocuments();
    } catch (e: any) {
      console.error(e);
      alert(`Error al firmar: ${e.message || "Error"}`);
    } finally {
      setIsSigning(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6" }}>
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
            Usuario: <strong>{user.username}</strong> ({user.fullName})
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

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedMonth(value);
                if (!value) {
                  setSelectedPayrollId(null);
                  return;
                }
                const [year, month] = value.split("-");
                const p = payrolls.find((x) => x.year === year && x.month === month);
                setSelectedPayrollId(p ? p.id : null);
              }}
              style={{
                padding: "0.4rem",
                borderRadius: "0.25rem",
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Selecciona mes</option>
              {payrolls.map((p) => (
                <option key={p.id} value={`${p.year}-${p.month}`}>
                  {monthLabel(`${p.year}-${p.month}`)}
                </option>
              ))}
            </select>

            <button
              disabled={!selectedPayrollId}
              onClick={() => handleDownload("payroll", selectedPayrollId!)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.25rem",
                border: "1px solid #2563eb",
                backgroundColor: "#2563eb",
                color: "#fff",
                cursor: !selectedPayrollId ? "not-allowed" : "pointer",
                opacity: !selectedPayrollId ? 0.6 : 1,
              }}
            >
              Descargar
            </button>

            <button
              disabled={!selectedPayrollId || isSigning}
              onClick={() => setIsSignatureModalOpen(true)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "0.25rem",
                border: "1px solid #059669",
                backgroundColor: "#059669",
                color: "#fff",
                cursor: !selectedPayrollId || isSigning ? "not-allowed" : "pointer",
                opacity: !selectedPayrollId || isSigning ? 0.6 : 1,
              }}
            >
              {isSigning ? "Firmando..." : "Firmar nómina"}
            </button>
          </div>

          <p style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.8rem", color: "#6b7280" }}>
            Al firmar, la nómina se reemplaza por la versión firmada y se descargará así en adelante.
          </p>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>
              No hay contrato disponible. Contacta con administración.
            </p>
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

      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={signSelectedPayroll}
      />
    </div>
  );
};

export default DocumentsPage;
