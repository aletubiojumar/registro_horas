import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import SignaturePad from "signature_pad";

type SignatureModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
};

const modalStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "0.5rem",
  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  padding: "1.25rem",
  width: "100%",
  maxWidth: 500,
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "0.5rem",
  marginTop: "0.75rem",
};

const buttonStyle: CSSProperties = {
  padding: "0.35rem 0.75rem",
  fontSize: "0.8rem",
  borderRadius: "0.3rem",
  border: "1px solid #d1d5db",
  backgroundColor: "#ffffff",
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#2563eb",
  color: "#ffffff",
  borderColor: "#2563eb",
};

const SignatureModal = ({ isOpen, onClose, onSave }: SignatureModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ajustamos tamaño del canvas
    const resizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.offsetWidth || 400;
      const height = 150;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }
      // Limpiar y resetear
      padRef.current?.clear();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255,255,255)",
      penColor: "rgb(15,23,42)",
    });
    padRef.current = pad;

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      pad.off();
      padRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    padRef.current?.clear();
  };

  const handleSave = () => {
    const pad = padRef.current;
    if (!pad) return;
    if (pad.isEmpty()) {
      alert("Dibuja tu firma antes de guardar.");
      return;
    }
    const dataUrl = pad.toDataURL("image/png");
    onSave(dataUrl);
    onClose();
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          Registrar firma
        </h2>
        <p style={{ fontSize: "0.8rem", color: "#4b5563", marginBottom: "0.5rem" }}>
          Dibuja tu firma con el ratón (o dedo si usas pantalla táctil). Puedes
          borrarla y repetirla tantas veces como quieras.
        </p>
        <div
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            padding: "0.25rem",
            backgroundColor: "#f9fafb",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "150px", display: "block" }}
          />
        </div>

        <div style={buttonRowStyle}>
          <button style={buttonStyle} type="button" onClick={handleClear}>
            Borrar
          </button>
          <button style={buttonStyle} type="button" onClick={onClose}>
            Cancelar
          </button>
          <button style={primaryButtonStyle} type="button" onClick={handleSave}>
            Guardar firma
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
