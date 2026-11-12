import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie_consent")) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem("cookie_consent", "true");
    setVisible(false);
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9998,
      background: "rgba(10,10,10,0.95)", backdropFilter: "blur(12px)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "14px 20px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap",
    }}>
      <p style={{ color: "#ccc", fontSize: 13, margin: 0, maxWidth: 600, textAlign: "center" }}>
        Usamos almacenamiento local para mantener tu sesión y preferencias.
        Consulta nuestra{" "}
        <Link to="/privacy" style={{ color: "#31a1c5", textDecoration: "underline" }}>Política de Privacidad</Link>.
      </p>
      <button
        onClick={accept}
        style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "#31a1c5", color: "#0a0a0a", fontSize: 13, fontWeight: 700,
          cursor: "pointer", flexShrink: 0,
        }}
      >
        Aceptar
      </button>
    </div>
  );
};
