import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../features/auth/authService";
import { KeyRound } from "lucide-react";

export const ChangePasswordOverlay: React.FC = () => {
  const { clearMustChangePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Las contraseñas nuevas no coinciden."); return; }
    if (newPassword.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await authService.changePassword(currentPassword, newPassword);
      localStorage.setItem("barber_token", data.token);
      localStorage.setItem("barber_refresh_token", data.refreshToken);
      clearMustChangePassword();
    } catch {
      setError("Contraseña temporal incorrecta. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", background: "var(--color-bg)" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: "50%", marginBottom: 16,
            background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
          }}>
            <KeyRound size={22} style={{ color: "var(--color-primary)" }} />
          </div>
          <h1 style={{ color: "var(--color-text)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Cambia tu contraseña
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 280, margin: "0 auto" }}>
            Es tu primer acceso. Crea una contraseña personal antes de continuar.
          </p>
        </div>

        <div style={{
          borderRadius: 16, padding: 24,
          background: "var(--color-glass-surface)",
          border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}>
          <form style={{ display: "flex", flexDirection: "column", gap: 16 }} onSubmit={handleSubmit}>
            {error && (
              <div style={{ borderRadius: 10, padding: "12px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
                {error}
              </div>
            )}
            {[
              { label: "Contraseña temporal",          value: currentPassword, setter: setCurrentPassword,  placeholder: "La que te dio tu administrador" },
              { label: "Nueva contraseña",             value: newPassword,      setter: setNewPassword,      placeholder: "Mínimo 8 caracteres" },
              { label: "Confirmar nueva contraseña",   value: confirmPassword,  setter: setConfirmPassword,  placeholder: "••••••••" },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </label>
                <input
                  type="password"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  required
                  placeholder={placeholder}
                  className="input-theme"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13 }}
                />
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, marginTop: 4, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Guardando..." : "Establecer contraseña"}
            </button>
          </form>
        </div>

        <button
          onClick={logout}
          style={{ marginTop: 16, width: "100%", textAlign: "center", fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", transition: "color 150ms ease" }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
