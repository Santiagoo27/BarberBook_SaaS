import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CalendarCheck, Users, QrCode } from "lucide-react";
import { BeamsBackground } from "../../components/BeamsBackground";

/* ── Input style base ───────────────────────────────────── */
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

const FEATURES = [
  { icon: CalendarCheck, text: "Agenda y citas en tiempo real" },
  { icon: Users,         text: "Multi-barbero y horarios semanales" },
  { icon: QrCode,        text: "Booking público con QR de reseñas" },
];

/* ── Component ──────────────────────────────────────────── */
export const Login: React.FC = () => {
  const { loginGlobal } = useAuth();
  const { logoBase64, tenantName } = useTheme();
  const navigate = useNavigate();
  const cachedTenantId = localStorage.getItem("barber_tenant_id");
  const displayName = tenantName || cachedTenantId;
  const hasReturnTenant = !!displayName;

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Completa todos los campos."); return; }
    setError(null); setLoading(true);
    try {
      const { role } = await loginGlobal({ email: email.trim(), password });
      navigate(role === "Barbero" ? "/barber" : role === "SuperAdmin" ? "/superadmin" : "/dashboard");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "Credenciales incorrectas.");
      setLoading(false);
    }
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--color-primary)";
    e.target.style.boxShadow = "0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent)";
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = "var(--color-border)";
    e.target.style.boxShadow = "none";
  };

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: "var(--color-bg, #0a0a0a)",
        animation: "fadeIn 200ms ease",
      }}>
        <img src="/logo.png" alt="BarberBook" style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 24 }} />
        <span style={{
          width: 28, height: 28, borderRadius: "50%",
          border: "2.5px solid var(--color-border, #2a2a2a)",
          borderTopColor: "var(--color-primary, #D4AF37)",
          animation: "spin 0.7s linear infinite",
          display: "block",
        }} />
        <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div className="login-root">

      {/* ══ Panel izquierdo — branding ══════════════════════ */}
      <div
        className="login-left fade-up"
        style={{
          position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "52px 48px",
          background: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg))",
          borderRight: "1px solid var(--color-glass-border)",
        }}
      >
        {/* Dot texture */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--color-primary) 22%, transparent) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            opacity: 0.28,
          }}
        />

        {/* Glow bottom-left */}
        <div
          aria-hidden
          style={{
            position: "absolute", bottom: "-10%", left: "-15%",
            width: "80%", height: "60%",
            background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo BarberBook */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <img src="/logo.png" alt="BarberBook" style={{ width: 50, height: 50, objectFit: "contain" }} />
        </div>

        {/* Brand copy + features */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{
            color: "var(--color-text)", fontSize: 38, fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1.05, marginBottom: 14,
          }}>
            BarberBook
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.65, maxWidth: 280 }}>
            Gestiona citas, barberos y servicios desde un solo panel.
          </p>

          <div className="login-features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div
                key={text}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 11,
                  padding: "9px 14px", borderRadius: 9,
                  background: "color-mix(in srgb, var(--color-glass-surface) 55%, transparent)",
                  border: "1px solid var(--color-glass-border)",
                }}
              >
                <Icon size={13} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                <span style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 500 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ position: "relative", zIndex: 1, color: "var(--color-text-muted)", fontSize: 11, opacity: 0.45 }}>
          © 2026 BarberBook
        </p>
      </div>

      {/* ══ Panel derecho — formulario ═══════════════════════ */}
      <div className="login-right">

        {/* Beams animation — fills login-right (position:relative) */}
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
          style={{ width: "100%", maxWidth: 400, position: "relative", zIndex: 1, animationDelay: "80ms" }}
        >
          {/* Tenant branding + título */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            {hasReturnTenant && logoBase64 && (
              <div style={{
                width: 72, height: 72, borderRadius: 16, overflow: "hidden", margin: "0 auto 14px",
                background: "var(--color-surface)", border: "2px solid var(--color-glass-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
              }}>
                <img
                  src={logoBase64.startsWith("data:") ? logoBase64 : `data:image/png;base64,${logoBase64}`}
                  alt={displayName!}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
            )}
            <h2 style={{
              color: "var(--color-text)", fontSize: 26, fontWeight: 800,
              letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 8,
            }}>
              {hasReturnTenant ? `Bienvenido a ${displayName}` : "Bienvenido de vuelta"}
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5 }}>
              Ingresa con tu cuenta de administrador o barbero.
            </p>
          </div>

          {/* Form card glass */}
          <div
            style={{
              borderRadius: 18, padding: "32px 28px",
              background: "var(--color-glass-surface)",
              border: "1px solid var(--color-glass-border)",
              backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Accent line top */}
            <div style={{
              height: 1, marginBottom: 28,
              marginLeft: -28, marginRight: -28, marginTop: -32,
              background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 50%, transparent), transparent)",
            }} />

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {error && (
                <div style={{
                  borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.5,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
                }}>
                  {error}
                </div>
              )}

              {/* Email */}
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

              {/* Password */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ ...LABEL, marginBottom: 0 }}>Contraseña</label>
                  <Link
                    to="/forgot-password"
                    style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-muted)", textDecoration: "none" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--color-primary)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
                  >
                    ¿Olvidaste la tuya?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 4,
                }}
              >
                {loading ? "Verificando..." : "Ingresar al panel"}
              </button>
            </form>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--color-text-muted)", marginTop: 24 }}>
            ¿Eres cliente? Accede al link de tu barbería.
          </p>
        </div>
      </div>
    </div>
  );
};