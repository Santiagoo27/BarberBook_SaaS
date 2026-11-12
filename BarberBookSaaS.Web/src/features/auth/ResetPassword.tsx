import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
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

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawToken = searchParams.get("token") ?? "";

  const isCustomerReset = rawToken.includes("?reset_token=");
  const customerSubdomain = isCustomerReset ? rawToken.split("?")[0].replace(/^\{\{1\}\}/, "") : "";
  const token = rawToken;

  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (!token) setError("Enlace inválido. Por favor, solicita un nuevo enlace."); }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    setError(null); setLoading(true);
    try {
      await apiClient.post("/api/auth/reset-password", { token, newPassword });
      setSuccess(true);
      if (isCustomerReset) {
        setTimeout(() => { window.location.href = `/book/${customerSubdomain}`; }, 3000);
      } else {
        setTimeout(() => navigate("/login"), 3000);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "El enlace es inválido o ha expirado.");
    } finally { setLoading(false); }
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

          {success ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                marginBottom: 20,
              }}>
                <CheckCircle size={22} style={{ color: "var(--color-primary)" }} />
              </div>
              <h2 style={{
                color: "var(--color-text)", fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", marginBottom: 10,
              }}>
                Contraseña actualizada
              </h2>
              <p style={{
                color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.65,
                maxWidth: 280, margin: "0 auto 28px",
              }}>
                {isCustomerReset
                  ? "Serás redirigido al agendamiento de citas en unos segundos."
                  : "Serás redirigido al inicio de sesión en unos segundos."}
              </p>
              <a
                href={isCustomerReset ? `/book/${customerSubdomain}` : "/login"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 600, color: "var(--color-primary)",
                  textDecoration: "none", transition: "opacity 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <ArrowLeft size={14} /> {isCustomerReset ? "Volver al agendamiento de citas" : "Ir al inicio de sesión"}
              </a>
            </div>
          ) : (
            <>
              <h2 style={{
                color: "var(--color-text)", fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", marginBottom: 8,
              }}>
                Nueva contraseña
              </h2>
              <p style={{
                color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.6,
                marginBottom: 24,
              }}>
                {isCustomerReset
                  ? "Ingresa tu nueva contraseña para tu cuenta."
                  : "Ingresa tu nueva contraseña para acceder al panel."}
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

                {/* Nueva contraseña */}
                <div>
                  <label style={LABEL}>Nueva contraseña</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      autoFocus disabled={!token}
                      placeholder="Mínimo 6 caracteres"
                      style={{ ...INPUT, paddingRight: 44 }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--color-text-muted)", transition: "color 150ms ease",
                        display: "flex", alignItems: "center", padding: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar contraseña */}
                <div>
                  <label style={LABEL}>Confirmar contraseña</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={!token}
                      placeholder="Repite tu contraseña"
                      style={{ ...INPUT, paddingRight: 44 }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      style={{
                        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--color-text-muted)", transition: "color 150ms ease",
                        display: "flex", alignItems: "center", padding: 0,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="btn-primary"
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4,
                  }}
                >
                  {loading ? "Guardando..." : "Guardar contraseña"}
                </button>
              </form>

              <a
                href={isCustomerReset ? `/book/${customerSubdomain}` : "/login"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontSize: 12, color: "var(--color-text-muted)", textDecoration: "none",
                  marginTop: 20, transition: "color 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                <ArrowLeft size={13} /> {isCustomerReset ? "Volver al agendamiento de citas" : "Volver al inicio de sesión"}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
