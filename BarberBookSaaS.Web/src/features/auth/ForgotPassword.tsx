import React, { useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { Mail, ArrowLeft } from "lucide-react";
import { BeamsBackground } from "../../components/BeamsBackground";

const INPUT: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 10, fontSize: 14,
  background: "var(--color-surface)", color: "var(--color-text)",
  border: "1px solid var(--color-border)", outline: "none",
  caretColor: "var(--color-primary)", boxSizing: "border-box",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "var(--color-text-muted)", textTransform: "uppercase",
  letterSpacing: "0.10em", marginBottom: 8,
};

export const ForgotPassword: React.FC = () => {
  const [email, setEmail]         = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Por favor, ingresa tu correo electrónico."); return; }
    setError(null); setLoading(true);
    try { await apiClient.post("/api/auth/forgot-password", { email: email.trim() }); }
    catch { /* show success regardless */ }
    finally { setLoading(false); setSubmitted(true); }
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--color-primary)";
    e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--color-border)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "48px 24px", position: "relative", overflow: "hidden",
      background: "var(--color-bg)",
    }}>
      <BeamsBackground />

      {/* Glow ambiental */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "-20%", right: "-15%",
          width: "55%", height: "65%",
          background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="fade-up"
        style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1 }}
      >
        {/* Header — Logo + Marca */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 13,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--color-primary)",
            boxShadow: "0 0 36px color-mix(in srgb, var(--color-primary) 45%, transparent), 0 0 72px color-mix(in srgb, var(--color-primary) 12%, transparent)",
            marginBottom: 16,
          }}>
            <img src="/logo.png" alt="BarberBook" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1 style={{
            color: "var(--color-text)", fontSize: 28, fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6,
          }}>
            BarberBook
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
            Panel Administrativo
          </p>
        </div>

        {/* Card glass */}
        <div style={{
          borderRadius: 18, padding: "32px 28px",
          background: "var(--color-glass-surface)",
          border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          {/* Accent line top */}
          <div style={{
            height: 1, marginBottom: 28,
            marginLeft: -28, marginRight: -28, marginTop: -32,
            background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 50%, transparent), transparent)",
          }} />

          {submitted ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                marginBottom: 20,
              }}>
                <Mail size={22} style={{ color: "var(--color-primary)" }} />
              </div>
              <h2 style={{
                color: "var(--color-text)", fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", marginBottom: 10,
              }}>
                Revisa tu correo
              </h2>
              <p style={{
                color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.65,
                maxWidth: 280, margin: "0 auto 28px",
              }}>
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link
                to="/login"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: "var(--color-primary)",
                  textDecoration: "none", transition: "opacity 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{
                color: "var(--color-text)", fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", marginBottom: 8,
              }}>
                Olvidé mi contraseña
              </h2>
              <p style={{
                color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.6,
                marginBottom: 24,
              }}>
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {error && (
                  <div style={{
                    borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.5,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
                  }}>
                    {error}
                  </div>
                )}

                <div>
                  <label style={LABEL}>Correo electrónico</label>
                  <input
                    type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus placeholder="admin@tubarberia.com"
                    style={INPUT}
                    onFocus={onFocus} onBlur={onBlur}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4,
                  }}
                >
                  {loading ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>

              <Link
                to="/login"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 12, color: "var(--color-text-muted)", textDecoration: "none",
                  marginTop: 20, transition: "color 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                <ArrowLeft size={13} /> Volver al inicio de sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
