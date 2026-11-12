import React, { useState, useEffect, useCallback } from "react";
import { reviewService } from "./reviewService";
import type { AdminReviewsResponse } from "./reviewService";
import { Star, MessageSquare } from "lucide-react";

/* ── Star renderer using inline styles (Tailwind v4 fill classes unreliable) */
const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => (
  <span style={{ display: "inline-flex", gap: "2px" }}>
    {[1,2,3,4,5].map(i => (
      <Star
        key={i} size={size}
        style={{
          fill: i <= value ? "#f59e0b" : "transparent",
          color: i <= value ? "#f59e0b" : "var(--color-border)",
          flexShrink: 0,
        }}
      />
    ))}
  </span>
);

/* ── Date helpers ─────────────────────────────────────── */
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY = localDate();
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

/* ── Avatar palette for review items ─────────────────── */
const REVIEW_COLORS = [
  { bg: "color-mix(in srgb, var(--color-primary) 18%, transparent)", color: "var(--color-primary)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 18%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)" },
  { bg: "rgba(16,185,129,0.16)", color: "#34d399" },
  { bg: "rgba(245,158,11,0.16)", color: "#f59e0b" },
];

type QuickFilter = "all" | "today" | "7d" | "30d" | "custom";

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: "all",   label: "Todo" },
  { key: "today", label: "Hoy" },
  { key: "7d",    label: "7 días" },
  { key: "30d",   label: "30 días" },
  { key: "custom", label: "Personalizado" },
];

export const AdminReviews: React.FC = () => {
  const [data, setData]           = useState<AdminReviewsResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");

  const load = useCallback(async (f?: string, t?: string) => {
    setLoading(true);
    try { setData(await reviewService.getAdminReviews({ limit: 200, from: f || undefined, to: t || undefined })); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyQuick = (key: QuickFilter) => {
    setQuickFilter(key);
    if (key === "all")   { setFrom(""); setTo(""); load(); }
    if (key === "today") { setFrom(TODAY); setTo(TODAY); load(TODAY, TODAY); }
    if (key === "7d")    { const f = daysAgo(7); setFrom(f); setTo(TODAY); load(f, TODAY); }
    if (key === "30d")   { const f = daysAgo(30); setFrom(f); setTo(TODAY); load(f, TODAY); }
    if (key === "custom") { /* handled by the form */ }
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickFilter("custom");
    load(from || undefined, to || undefined);
  };

  const dist = data
    ? [5,4,3,2,1].map(star => ({
        star,
        count: data.reviews.filter(r => r.rating === star).length,
        pct: data.totalReviews > 0
          ? (data.reviews.filter(r => r.rating === star).length / data.totalReviews) * 100
          : 0,
      }))
    : [];

  return (
    <div className="space-y-6 fade-up">

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
          background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
        }} />
        <h1 style={{ color: "var(--color-text)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
          Reseñas
        </h1>
      </div>

      {/* ── Summary cards ────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          {[0,1].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 148, borderRadius: 16 }} />
          ))}
        </div>
      ) : data && data.totalReviews > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>

          {/* Average score */}
          <div
            className="fade-up"
            style={{
              borderRadius: "16px", padding: "28px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px",
              background: "var(--color-glass-surface)",
              border: "1px solid var(--color-glass-border)",
              textAlign: "center",
            }}
          >
            <p style={{
              fontSize: "56px", fontWeight: 800, lineHeight: 1,
              letterSpacing: "-0.04em", color: "var(--color-text)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {data.averageRating.toFixed(1)}
            </p>
            <Stars value={Math.round(data.averageRating)} size={20} />
            <p style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600 }}>
              {data.totalReviews} reseña{data.totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Distribution bars */}
          <div
            className="fade-up"
            style={{
              borderRadius: "16px", padding: "20px 24px",
              background: "var(--color-glass-surface)",
              border: "1px solid var(--color-glass-border)",
              display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px",
              animationDelay: "60ms",
            }}
          >
            {dist.map(({ star, count, pct }) => (
              <div key={star} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600, minWidth: 10, textAlign: "right" }}>
                  {star}
                </span>
                <Star size={11} style={{ fill: "#f59e0b", color: "#f59e0b", flexShrink: 0 }} />
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--color-glass-border)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${pct}%`,
                    background: star >= 4
                      ? "linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 60%, #f59e0b))"
                      : star === 3
                      ? "#f59e0b"
                      : "#ef4444",
                    transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
                  }} />
                </div>
                <span style={{ color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600, minWidth: 20, textAlign: "right" }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Filter chips ─────────────────────────────────────── */}
      <div className="reviews-filters" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Quick filter chips */}
        <div style={{
          display: "inline-flex", gap: "4px", padding: "4px", borderRadius: "12px",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          alignSelf: "flex-start",
        }}>
          {QUICK_FILTERS.filter(f => f.key !== "custom").map(f => {
            const isActive = quickFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => applyQuick(f.key)}
                style={{
                  padding: "5px 12px", borderRadius: "8px",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
                  background: isActive
                    ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                    : "transparent",
                  color: isActive ? "#000" : "var(--color-text-muted)",
                  boxShadow: isActive ? "0 2px 8px color-mix(in srgb, var(--color-primary) 38%, transparent)" : "none",
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = "var(--color-glass-surface-hover)"; e.currentTarget.style.color = "var(--color-text)"; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; } }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Custom date range */}
        <form onSubmit={applyCustom} className="reviews-date-form" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <input
            type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: "8px", fontSize: "12px",
              background: "var(--color-surface)", color: "var(--color-text)",
              border: "1px solid var(--color-border)", outline: "none",
              width: "140px", minWidth: 0, flex: "0 1 140px",
            }}
          />
          <span style={{ color: "var(--color-text-muted)", fontSize: "12px", flexShrink: 0 }}>—</span>
          <input
            type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: "8px", fontSize: "12px",
              background: "var(--color-surface)", color: "var(--color-text)",
              border: "1px solid var(--color-border)", outline: "none",
              width: "140px", minWidth: 0, flex: "0 1 140px",
            }}
          />
          <button
            type="submit"
            className="btn-ghost"
            style={{
              padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            Aplicar
          </button>
        </form>
      </div>

      {/* ── Reviews list ─────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} className="skeleton-shimmer fade-up" style={{ height: 72, borderRadius: 14, animationDelay: `${i * 55}ms` }} />
          ))}
        </div>
      ) : !data || data.totalReviews === 0 ? (
        <div
          className="fade-up"
          style={{
            borderRadius: "20px", padding: "72px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            background: "var(--color-glass-surface)", border: "1px dashed var(--color-glass-border)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", animationDelay: "60ms",
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: "14px", marginBottom: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
            color: "var(--color-primary)",
          }}>
            <Star size={20} />
          </div>
          <p style={{ color: "var(--color-text)", fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Sin reseñas todavía
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px", maxWidth: 300, lineHeight: 1.5 }}>
            Comparte el QR con tus clientes desde <strong style={{ color: "var(--color-text)" }}>Mi Barbería</strong> para empezar a recibir opiniones.
          </p>
        </div>
      ) : data.reviews.length === 0 ? (
        <div
          className="fade-up"
          style={{
            borderRadius: "16px", padding: "48px 24px", textAlign: "center",
            background: "var(--color-glass-surface)", border: "1px dashed var(--color-glass-border)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
            No hay reseñas en el rango de fechas seleccionado.
          </p>
        </div>
      ) : (
        <div
          className="fade-up"
          style={{
            borderRadius: "16px", overflow: "hidden",
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {data.reviews.map((review, idx) => {
            const palette = REVIEW_COLORS[idx % REVIEW_COLORS.length];
            return (
              <div
                key={review.id}
                className="fade-up"
                style={{
                  display: "flex", alignItems: "flex-start", gap: "14px",
                  padding: "16px 20px",
                  borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
                  transition: "background 150ms ease",
                  animationDelay: `${Math.min(idx * 30, 240)}ms`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-glass-surface-hover)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Star icon badge */}
                <div style={{
                  width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: palette.bg, color: palette.color,
                  fontSize: "14px", fontWeight: 700,
                }}>
                  {review.rating}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                    <Stars value={review.rating} size={13} />
                  </div>
                  {review.comment ? (
                    <p style={{ color: "var(--color-text)", fontSize: "14px", lineHeight: 1.5 }}>
                      {review.comment}
                    </p>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <MessageSquare size={12} style={{ color: "var(--color-text-muted)" }} />
                      <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                        Sin comentario
                      </p>
                    </div>
                  )}
                </div>

                {/* Date */}
                <span style={{
                  flexShrink: 0, color: "var(--color-text-muted)",
                  fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", paddingTop: "2px",
                }}>
                  {formatDate(review.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};