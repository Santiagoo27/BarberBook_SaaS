import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Star } from "lucide-react";
import { reviewService } from "./reviewService";
import type { ReviewSummary } from "./reviewService";
import { bookingService } from "../booking/bookingService";
import type { PublicBranding } from "../booking/bookingTypes";
import { ShadowOverlayBackground } from "../../components/ShadowOverlayBackground";
import { useTheme } from "../../context/ThemeContext";

const RATING_LABELS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

export const ReviewPage: React.FC = () => {
  const { subdomain = "" } = useParams<{ subdomain: string }>();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("cita") ?? undefined;
  const { theme } = useTheme();
  const bgThemeMode = theme === "light-modern" ? "light" : "dark";

  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomerLoggedIn = (): boolean => {
    try {
      const token = localStorage.getItem("customer_token");
      const user = localStorage.getItem("customer_user");
      if (!token || !user) return false;
      const parsed = JSON.parse(user);
      return parsed.tenantId === subdomain;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!subdomain) return;
    let active = true;
    bookingService.getBranding(subdomain)
      .then((b) => {
        if (!active) return;
        setBranding(b);
        reviewService.getSummary(subdomain).then((s) => active && setSummary(s)).catch(() => {});
      })
      .catch((e: unknown) => {
        if (!active) return;
        const err = e as { response?: { status?: number } };
        if (err?.response?.status === 503) setSuspended(true);
        else setNotFound(true);
      })
      .finally(() => active && setDataLoading(false));
    return () => { active = false; };
  }, [subdomain]);

  useEffect(() => {
    if (branding?.primaryColor) {
      document.documentElement.style.setProperty("--color-primary", branding.primaryColor);
    }
  }, [branding?.primaryColor]);

  const primaryColor = branding?.primaryColor ?? "#D4AF37";
  const tenantName = branding?.name ?? subdomain;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Por favor selecciona una calificación.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await reviewService.submitReview(subdomain, rating, comment.trim() || undefined, appointmentId);
      setDone(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 429) {
        setError("Demasiados intentos. Espera unos minutos y vuelve a intentarlo.");
      } else if (axiosErr.response?.status === 401) {
        setError("Tu sesión expiró. Recarga la página e inicia sesión de nuevo.");
      } else if (axiosErr.response?.data?.message) {
        setError(axiosErr.response.data.message);
      } else {
        setError("Ocurrió un error al enviar tu reseña. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (dataLoading) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--color-bg)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid var(--color-glass-border)",
          borderTopColor: primaryColor,
          animation: "review-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes review-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Suspended ─────────────────────────────────────────────────────────────
  if (suspended) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#0a0a0a", padding: "24px", textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f5f5f5", marginBottom: 8 }}>
          Servicio suspendido
        </h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", maxWidth: 320, lineHeight: 1.6 }}>
          Esta barbería tiene el servicio temporalmente suspendido. Contacta al administrador para más información.
        </p>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--color-bg)", padding: "24px", textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /><path d="M11 8v3M11 14h.01" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
          Barbería no encontrada
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          El subdominio <strong style={{ color: "var(--color-text)" }}>{subdomain}</strong> no está registrado en BarberBook.
        </p>
      </div>
    );
  }

  // ── Glass helpers ─────────────────────────────────────────────────────────
  const isDarkTheme = theme !== "light-modern";

  const glassContainer: React.CSSProperties = {
    background: "var(--color-sidebar)",
    border: "1px solid var(--color-border)",
    boxShadow: isDarkTheme ? "0 4px 24px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.07)",
  };

  const renderAvatar = (size: number) => {
    if (branding?.logoBase64) {
      return (
        <img
          src={branding.logoBase64}
          alt={`Logo de ${tenantName}`}
          style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
      );
    }
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: primaryColor, color: "#000", fontWeight: 800,
        fontSize: size * 0.42, flexShrink: 0,
      }}>
        {tenantName.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderStaticStars = (value: number, size: number) => (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          style={{
            fill: s <= value ? primaryColor : "transparent",
            color: s <= value ? primaryColor : "var(--color-border)",
          }}
        />
      ))}
    </div>
  );

  // ── Form ──────────────────────────────────────────────────────────────────
  const renderForm = () => {
    if (!isCustomerLoggedIn()) {
      return (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", textAlign: "center" }}>
          <div>
            <h1 style={{
              fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 800,
              letterSpacing: "-0.02em", color: "var(--color-text)",
              marginBottom: 6, lineHeight: 1.2, textWrap: "balance",
            } as React.CSSProperties}>
              Dejar una reseña
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 8 }}>
              Debes iniciar sesión para dejar una reseña.
            </p>
          </div>
          <a
            href={`/book/${subdomain}`}
            className="btn-primary"
            style={{ display: "inline-block", padding: "13px 32px", borderRadius: 10, fontSize: 14, textDecoration: "none" }}
          >
            Iniciar sesión
          </a>
        </div>
      );
    }

    return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{
          fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 800,
          letterSpacing: "-0.02em", color: "var(--color-text)",
          marginBottom: 6, lineHeight: 1.2, textWrap: "balance",
        } as React.CSSProperties}>
          ¿Cómo fue tu visita a {tenantName}?
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Tu opinión ayuda a otros clientes y a mejorar el servicio.
        </p>
        {summary && summary.totalReviews > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 14, padding: "6px 14px", borderRadius: 10,
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
            fontSize: 13, color: "var(--color-text)",
          }}>
            <Star size={14} style={{ fill: "#f59e0b", color: "#f59e0b" }} />
            <span style={{ fontWeight: 700 }}>{summary.averageRating.toFixed(1)}</span>
            <span style={{ color: "var(--color-text-muted)" }}>
              · {summary.totalReviews} reseña{summary.totalReviews !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ borderRadius: 16, overflow: "hidden", ...glassContainer }}>
        <div style={{
          padding: "32px 24px 24px", display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10,
          borderBottom: "1px solid var(--color-glass-border)",
        }}>
          <div style={{ display: "flex", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((s) => {
              const active = s <= (hovered || rating);
              return (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  aria-label={`${s} estrella${s !== 1 ? "s" : ""}`}
                  style={{
                    background: "none", border: "none", padding: 4, lineHeight: 0,
                    cursor: "pointer",
                    transform: active ? "scale(1.1)" : "scale(1)",
                    transition: "transform 200ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <Star
                    size={36}
                    style={{
                      fill: active ? primaryColor : "transparent",
                      color: active ? primaryColor : "var(--color-border)",
                      filter: active
                        ? `drop-shadow(0 0 10px color-mix(in srgb, ${primaryColor} 55%, transparent))`
                        : "none",
                      transition: "fill 150ms ease, color 150ms ease, filter 150ms ease",
                    }}
                  />
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, height: 18, color: "var(--color-text-muted)" }}>
            {RATING_LABELS[hovered || rating]}
          </p>
        </div>

        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="review-comment" style={{
              display: "block", fontSize: 12, fontWeight: 500,
              color: "var(--color-text-muted)", marginBottom: 8,
            }}>
              Comentario <span>(opcional)</span>
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Cuéntanos tu experiencia…"
              className="input-theme"
              style={{
                width: "100%", borderRadius: 10, padding: "12px 14px",
                fontSize: 14, resize: "none", fontFamily: "inherit",
              }}
            />
            <p style={{ textAlign: "right", fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              {comment.length}/500
            </p>
          </div>

          {error && (
            <div style={{
              borderRadius: 8, padding: "10px 14px", fontSize: 13,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="btn-primary"
            style={{
              width: "100%", padding: "14px", borderRadius: 10, fontSize: 15,
              border: "none", cursor: submitting || rating === 0 ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Enviando…" : "Enviar reseña"}
          </button>
        </div>
      </form>

      <a
        href={`/book/${subdomain}`}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none",
          transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver al inicio
      </a>
    </div>
  );
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  const renderDone = () => (
    <div className="fade-up" style={{
      textAlign: "center", padding: "32px 0 16px",
      display: "flex", flexDirection: "column", gap: 20,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: primaryColor, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M5 14l7 7 11-11" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <h1 style={{
          fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em",
          color: "var(--color-text)", marginBottom: 4, textWrap: "balance",
        } as React.CSSProperties}>
          Gracias por tu opinión
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Tu reseña ayuda a {tenantName} a mejorar el servicio.
        </p>
      </div>

      <div style={{
        borderRadius: 14, padding: 20,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        ...glassContainer,
      }}>
        {renderStaticStars(rating, 24)}
        {comment.trim() && (
          <p style={{
            fontSize: 13, color: "var(--color-text)", lineHeight: 1.6,
            fontStyle: "italic", textAlign: "left",
          }}>
            "{comment.trim()}"
          </p>
        )}
      </div>

      <a
        href={`/book/${subdomain}`}
        className="btn-primary"
        style={{ display: "block", textAlign: "center", padding: "13px", borderRadius: 10, fontSize: 14, textDecoration: "none" }}
      >
        Volver al inicio
      </a>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", color: "var(--color-text)", position: "relative" }}>
      <ShadowOverlayBackground
        primaryColor={branding?.primaryColor ?? "#31a1c5"}
        secondaryColor={branding?.secondaryColor}
        themeMode={bgThemeMode}
      />

      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <header style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--color-header, var(--color-sidebar))",
          borderBottom: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{
            maxWidth: 680, margin: "0 auto", padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {renderAvatar(36)}
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>
                {tenantName}
              </span>
            </div>
            <a
              href={`/book/${subdomain}`}
              style={{
                fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)",
                textDecoration: "none", transition: "color 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
            >
              Reservar cita
            </a>
          </div>
        </header>

        <main style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 60px", width: "100%", flex: 1 }}>
          {done ? renderDone() : renderForm()}
        </main>

        <footer style={{
          textAlign: "center", padding: "20px 16px",
          fontSize: 11, color: "var(--color-text-muted)", opacity: 0.5,
        }}>
          Powered by BarberBook
        </footer>
      </div>
    </div>
  );
};