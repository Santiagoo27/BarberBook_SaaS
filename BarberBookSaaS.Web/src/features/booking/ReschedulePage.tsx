import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { bookingService } from "./bookingService";
import { RescheduleForm } from "./RescheduleForm";
import type { TokenAppointment, RescheduleResult } from "./bookingTypes";

const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][d.getUTCDay()];
  return `${day} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()} a las ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function statusLabel(status: string): string {
  if (status === "Pendiente")  return "Pendiente";
  if (status === "Cancelada")  return "Cancelada";
  if (status === "Completada") return "Completada";
  return status;
}

function notReschedulableReason(data: TokenAppointment): string {
  if (data.status !== "Pendiente")
    return "Esta cita ya no puede reprogramarse porque está " + statusLabel(data.status).toLowerCase() + ".";
  return "No es posible reprogramar con menos de 1 hora de antelación.";
}

const CARD: React.CSSProperties = {
  width: "100%", maxWidth: "440px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: "20px",
  padding: "32px",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
};

export const ReschedulePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<"loading" | "invalid" | "loaded" | "success">("loading");
  const [data, setData]               = useState<TokenAppointment | null>(null);
  const [successResult, setSuccessResult] = useState<RescheduleResult | null>(null);

  useEffect(() => {
    if (data) {
      const root = document.documentElement.style;
      root.setProperty("--color-primary", data.primaryColor);
      root.setProperty("--color-secondary", data.secondaryColor);
      root.setProperty("--color-bg", "#0a0a0a");
      root.setProperty("--color-surface", "rgba(255,255,255,0.06)");
      root.setProperty("--color-border", "rgba(255,255,255,0.12)");
      root.setProperty("--color-text", "#ffffff");
      root.setProperty("--color-text-muted", "rgba(255,255,255,0.5)");
      root.setProperty("--color-glass-border", "rgba(255,255,255,0.1)");
    }
  }, [data]);

  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }
    bookingService.getAppointmentByToken(token)
      .then((d) => { setData(d); setPageState("loaded"); })
      .catch(() => setPageState("invalid"));
  }, [token]);

  const primaryColor = data?.primaryColor ?? "#D4AF37";
  const logoSrc = data?.logoBase64
    ? `data:image/png;base64,${data.logoBase64}`
    : data?.logoUrl ?? null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "#D4AF37",
          animation: "rp-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Invalid ───────────────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
        <div style={{ ...CARD, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            Enlace no válido
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Este enlace no es válido o ya ha expirado.<br />
            Puedes agendar una nueva cita desde la página de tu barbería.
          </p>
          <Link
            to="/"
            style={{
              display: "inline-block", padding: "10px 24px", borderRadius: 10,
              background: "#D4AF37", color: "#000", fontWeight: 700, fontSize: 14,
              textDecoration: "none",
            }}
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState === "success" && successResult) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
        <div style={{ ...CARD, textAlign: "center" }}>
          {logoSrc && (
            <img src={logoSrc} alt="Logo" style={{ height: 48, objectFit: "contain", marginBottom: 16 }} />
          )}
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h1 style={{ color: primaryColor, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
            ¡Cita reprogramada!
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 15, lineHeight: 1.6 }}>
            Tu cita fue reprogramada para el<br />
            <strong style={{ color: "#fff" }}>{formatDate(successResult.appointmentDate)}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── Loaded ────────────────────────────────────────────────────────────────
  const d = data!;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: "24px" }}>
      <div style={CARD}>
        {logoSrc && (
          <img
            src={logoSrc}
            alt={d.tenantName ?? "Logo"}
            style={{ height: 40, objectFit: "contain", marginBottom: 16 }}
          />
        )}
        {d.tenantName && (
          <p style={{ color: primaryColor, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
            {d.tenantName}
          </p>
        )}

        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Reprogramar cita
        </h1>

        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "14px 16px", marginTop: 16, marginBottom: 20,
        }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Cita actual
          </p>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
            {d.serviceName} con {d.barberName}
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            {formatDate(d.appointmentDate)}
          </p>
        </div>

        {d.canReschedule ? (
          <RescheduleForm
            subdomain={d.subdomain}
            barberId={d.barberId}
            serviceId={d.serviceId}
            appointmentId={d.appointmentId}
            currentAppointmentDate={d.appointmentDate}
            primaryColor={primaryColor}
            onSubmit={async (newDateIso) => {
              try {
                const result = await bookingService.rescheduleAppointmentByToken(token!, newDateIso);
                setSuccessResult(result);
                setPageState("success");
              } catch (e: unknown) {
                const err = e as { response?: { data?: { message?: string } } };
                throw new Error(err?.response?.data?.message ?? "No se pudo reprogramar la cita.");
              }
            }}
          />
        ) : (
          <p style={{
            color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6,
            padding: "16px", borderRadius: 10,
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
          }}>
            {notReschedulableReason(d)}
          </p>
        )}
      </div>
    </div>
  );
};
