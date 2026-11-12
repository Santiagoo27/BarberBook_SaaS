import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { customerService } from "./customerService";
import type { CustomerListItem, LoyaltyConfig } from "./customerTypes";
import { Users, Gift, Plus, Minus, Search, AlertCircle, Award } from "lucide-react";

/* ── Portaled overlay styles ────────────────────────────── */
const BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0,
  backgroundColor: "rgba(0,0,0,0.72)",
  zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  backdropFilter: "blur(2px)",
};
const MODAL_BOX: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)",
  borderRadius: 20,
};

/* ── Avatar palette (deterministic by first char) ──────── */
const AVATAR_PALETTES = [
  { bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)", color: "var(--color-primary)", border: "color-mix(in srgb, var(--color-primary) 30%, transparent)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)", border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)" },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
];

function getAvatarPalette(name: string) {
  return AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
}

const CustomerAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 38 }) => {
  const p = getAvatarPalette(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.38), fontWeight: 700,
      background: p.bg, color: p.color, border: `1.5px solid ${p.border}`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

/* ── Loyalty progress bar ───────────────────────────────── */
const LoyaltyBar: React.FC<{ count: number; threshold: number }> = ({ count, threshold }) => {
  const pct = threshold > 0 ? Math.min(count / threshold, 1) : 0;
  const eligible = count >= threshold && threshold > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{
          flex: 1, height: 5, borderRadius: 99,
          background: "var(--color-glass-border)",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 99,
            width: `${pct * 100}%`,
            background: eligible
              ? "linear-gradient(90deg, #34d399, #10b981)"
              : "linear-gradient(90deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
            transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
          }} />
        </div>
        <span
          title={eligible ? "¡Cita gratis disponible!" : `Faltan ${threshold - count} corte${threshold - count !== 1 ? "s" : ""} para la cita gratis`}
          style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            color: eligible ? "#34d399" : "var(--color-text-muted)",
            cursor: "default",
          }}
        >
          {count}/{threshold}
        </span>
      </div>
    </div>
  );
};

/* ── Customer row ───────────────────────────────────────── */
interface CustomerRowProps {
  customer: CustomerListItem;
  threshold: number;
  loyaltyEnabled: boolean;
  last: boolean;
  onAward: () => void;
}

const CustomerRow: React.FC<CustomerRowProps> = ({ customer, threshold, loyaltyEnabled, last, onAward }) => {
  const eligible = loyaltyEnabled && threshold > 0 && customer.loyaltyCount >= threshold;

  return (
    <div
      className="customer-row"
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 24px",
        borderBottom: !last ? "1px solid var(--color-glass-border)" : undefined,
        transition: "background 160ms ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 4%, transparent)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Avatar */}
      <CustomerAvatar name={customer.name} size={38} />

      {/* Name + phone */}
      <div className="customer-row-name" style={{ flex: "0 0 200px", minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {customer.name}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
          {customer.phone}
        </p>
      </div>

      {/* Total visits */}
      <div className="customer-row-visits" style={{ flex: "0 0 120px", minWidth: 0, display: "flex", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {customer.loyaltyCount} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--color-text-muted)" }}>visita{customer.loyaltyCount !== 1 ? "s" : ""}</span>
        </p>
      </div>

      {/* Loyalty progress or disabled note */}
      <div className="customer-row-loyalty" style={{ flex: 1, minWidth: 120, display: "flex", alignItems: "center", gap: 10 }}>
        {loyaltyEnabled && threshold > 0 ? (
          <>
            <LoyaltyBar count={customer.loyaltyCount} threshold={threshold} />
            {eligible && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99, flexShrink: 0,
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
                background: "rgba(16,185,129,0.14)", color: "#34d399",
                border: "1px solid rgba(16,185,129,0.28)",
              }}>
                Cita gratis
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", opacity: 0.45 }}>
            {loyaltyEnabled ? "Sin umbral" : "Inactivo"}
          </span>
        )}
      </div>

      {/* Award button */}
      <button
        onClick={onAward}
        className="customer-row-action"
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, padding: "5px 12px", borderRadius: 8, fontWeight: 600, cursor: "pointer",
          border: "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
          background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
          color: "var(--color-primary)",
          transition: "background 150ms ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 18%, transparent)")}
        onMouseLeave={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 8%, transparent)")}
      >
        <Gift size={11} /> Puntos
      </button>
    </div>
  );
};

/* ── Skeleton row ───────────────────────────────────────── */
const SkeletonRow: React.FC<{ last?: boolean }> = ({ last }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 24px",
    borderBottom: !last ? "1px solid var(--color-glass-border)" : undefined,
  }}>
    <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }} />
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="skeleton-shimmer" style={{ height: 12, borderRadius: 6, width: "40%" }} />
      <div className="skeleton-shimmer" style={{ height: 10, borderRadius: 6, width: "25%" }} />
    </div>
    <div className="skeleton-shimmer" style={{ height: 10, borderRadius: 6, width: 120 }} />
    <div className="skeleton-shimmer" style={{ height: 24, borderRadius: 8, width: 70 }} />
  </div>
);

/* ── Main component ─────────────────────────────────────── */
export const CustomerPage: React.FC = () => {
  const [customers, setCustomers]         = useState<CustomerListItem[]>([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [toast, setToast]                 = useState<string | null>(null);

  // Award modal state
  const [awardTarget, setAwardTarget]     = useState<CustomerListItem | null>(null);
  const [awardPoints, setAwardPoints]     = useState(1);
  const [awarding, setAwarding]           = useState(false);
  const [awardError, setAwardError]       = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const load = async () => {
    try {
      setLoading(true); setError(null);
      const [result, config] = await Promise.all([
        customerService.getAll(1, 200),
        customerService.getLoyaltyConfig(),
      ]);
      setCustomers(result.data);
      setLoyaltyConfig(config);
    } catch {
      setError("No se pudo cargar la lista de clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, search]);

  const handleAward = async () => {
    if (!awardTarget || awardPoints < 1) return;
    setAwarding(true); setAwardError(null);
    try {
      await customerService.awardPoints(awardTarget.id, awardPoints);
      setAwardTarget(null);
      setAwardPoints(1);
      showToast(`+${awardPoints} punto${awardPoints !== 1 ? "s" : ""} otorgado${awardPoints !== 1 ? "s" : ""} a ${awardTarget.name}.`);
      await load();
    } catch {
      setAwardError("No se pudo otorgar los puntos. Intenta de nuevo.");
    } finally {
      setAwarding(false);
    }
  };

  const threshold = loyaltyConfig?.threshold ?? 0;
  const loyaltyEnabled = loyaltyConfig?.enabled ?? false;

  return (
    <div>

      {/* ── Header ──────────────────────────────────────── */}
      <div
        className="fade-up"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2.5rem" }}
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{
            width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
            background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
          }} />
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>
              Clientes
            </h1>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", margin: "6px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {loading ? "Cargando…" : `${customers.length} cliente${customers.length !== 1 ? "s" : ""} registrado${customers.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 13, marginBottom: "1.5rem",
        }}>
          {error}
        </div>
      )}

      {/* ── Loyalty active banner ────────────────────── */}
      {!loading && loyaltyEnabled && threshold > 0 && (
        <div
          className="fade-up"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 18px", borderRadius: 12, marginBottom: "1.5rem",
            background: "color-mix(in srgb, var(--color-primary) 7%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
            animationDelay: "60ms",
          }}
        >
          <Award size={15} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
            <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>Programa activo:</strong>{" "}
            cada <strong style={{ color: "var(--color-primary)", fontWeight: 700 }}>{threshold} corte{threshold !== 1 ? "s" : ""}</strong> completados,
            el cliente recibe su próxima cita gratis. La barra muestra el progreso de cada cliente hacia ese beneficio.
          </p>
        </div>
      )}

      {/* ── Loyalty disabled banner ──────────────────── */}
      {!loading && !loyaltyEnabled && (
        <div
          className="fade-up"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 18px", borderRadius: 12, marginBottom: "1.5rem",
            background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
            animationDelay: "60ms",
          }}
        >
          <AlertCircle size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#f59e0b", margin: 0 }}>
            El programa de fidelización está desactivado. Actívalo desde{" "}
            <a href="/branding" style={{ color: "#fbbf24", fontWeight: 700, textDecoration: "underline" }}>
              Mi Barbería → Fidelización
            </a>
            .
          </p>
        </div>
      )}

      {/* ── Search bar ──────────────────────────────── */}
      <div
        className="fade-up"
        style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: "1.25rem",
          background: "var(--color-glass-surface)",
          border: "1px solid var(--color-glass-border)",
          borderRadius: 12, padding: "0 14px",
          animationDelay: "80ms",
        }}
      >
        <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 13, color: "var(--color-text)", padding: "11px 0",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: "var(--color-text-muted)", display: "flex" }}
          >
            <Minus size={12} />
          </button>
        )}
      </div>

      {/* ── Customers list ──────────────────────────── */}
      <div
        className="fade-up"
        style={{
          borderRadius: 20,
          background: "var(--color-glass-surface)",
          border: "1px solid var(--color-glass-border)",
          overflow: "hidden",
          animationDelay: "120ms",
        }}
      >
        {/* Table header */}
        <div className="customer-list-header" style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "10px 24px",
          borderBottom: "1px solid var(--color-glass-border)",
          background: "color-mix(in srgb, var(--color-primary) 4%, transparent)",
        }}>
          <div style={{ width: 38, flexShrink: 0 }} />
          <div style={{ flex: "0 0 200px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Cliente
            </span>
          </div>
          <div style={{ flex: "0 0 120px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Visitas
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Fidelización{threshold > 0 && ` (umbral: ${threshold})`}
            </span>
          </div>
          <div style={{ width: 78, flexShrink: 0 }} />
        </div>

        {/* Rows */}
        {loading ? (
          <>
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} last={i === 4} />)}
          </>
        ) : filtered.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            padding: "72px 24px",
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {search ? <Search size={20} style={{ color: "var(--color-text-muted)" }} /> : <Users size={20} style={{ color: "var(--color-text-muted)" }} />}
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
                {search ? "Sin resultados" : "Sin clientes aún"}
              </p>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
                {search ? `No hay clientes que coincidan con "${search}".` : "Los clientes aparecen aquí cuando agendan su primera cita."}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((c, idx) => (
            <CustomerRow
              key={c.id}
              customer={c}
              threshold={threshold}
              loyaltyEnabled={loyaltyEnabled}
              last={idx === filtered.length - 1}
              onAward={() => { setAwardTarget(c); setAwardPoints(1); setAwardError(null); }}
            />
          ))
        )}
      </div>

      {/* ── Loyalty summary strip ────────────────────── */}
      {!loading && loyaltyEnabled && threshold > 0 && customers.length > 0 && (() => {
        const eligible = customers.filter(c => c.loyaltyCount >= threshold).length;
        const pct = Math.round((eligible / customers.length) * 100);
        return (
          <div
            className="fade-up"
            style={{
              display: "flex", alignItems: "center", gap: 16,
              marginTop: "1.25rem", padding: "14px 20px", borderRadius: 12,
              background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              animationDelay: "200ms",
            }}
          >
            <Award size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, flex: 1 }}>
              <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>{eligible}</strong> de {customers.length} clientes ({pct}%) han alcanzado el umbral de cita gratis.
            </p>
          </div>
        );
      })()}

      {/* ── Toast ───────────────────────────────────── */}
      {toast && createPortal(
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, padding: "10px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, color: "var(--color-text)",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)", whiteSpace: "nowrap",
        }}>
          {toast}
        </div>,
        document.body
      )}

      {/* ── Modal: otorgar puntos ────────────────────── */}
      {awardTarget && createPortal(
        <div style={BACKDROP}>
          <div style={{ ...MODAL_BOX, maxWidth: 380, width: "100%", padding: 24 }}>

            {/* Header */}
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
              }}>
                <Gift size={18} style={{ color: "var(--color-primary)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 3px" }}>
                  Otorgar puntos
                </h3>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                  Para <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>{awardTarget.name}</strong>
                  {loyaltyEnabled && threshold > 0 && (
                    <> · {awardTarget.loyaltyCount}/{threshold} puntos actuales</>
                  )}
                </p>
              </div>
            </div>

            {/* Points counter */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
              padding: "20px", borderRadius: 14, marginBottom: 16,
              background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))",
              border: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
            }}>
              <button
                onClick={() => setAwardPoints(p => Math.max(1, p - 1))}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid var(--color-glass-border)",
                  background: "var(--color-glass-surface)",
                  color: "var(--color-text-muted)", cursor: "pointer",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-glass-border)"; }}
              >
                <Minus size={14} />
              </button>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 44, fontWeight: 800, color: "var(--color-primary)", margin: 0, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {awardPoints}
                </p>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "4px 0 0" }}>
                  punto{awardPoints !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => setAwardPoints(p => Math.min(100, p + 1))}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid var(--color-glass-border)",
                  background: "var(--color-glass-surface)",
                  color: "var(--color-text-muted)", cursor: "pointer",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-glass-border)"; }}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Preview de resultado */}
            {loyaltyEnabled && threshold > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              }}>
                <div style={{ flex: 1 }}>
                  <LoyaltyBar
                    count={Math.min(awardTarget.loyaltyCount + awardPoints, threshold)}
                    threshold={threshold}
                  />
                </div>
                {(awardTarget.loyaltyCount + awardPoints) >= threshold && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 99, flexShrink: 0,
                    letterSpacing: "0.06em", textTransform: "uppercase" as const,
                    background: "rgba(16,185,129,0.14)", color: "#34d399", border: "1px solid rgba(16,185,129,0.28)",
                  }}>
                    Cita gratis
                  </span>
                )}
              </div>
            )}

            {awardError && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 14,
              }}>
                {awardError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setAwardTarget(null); setAwardPoints(1); setAwardError(null); }}
                className="btn-ghost"
                style={{ flex: 1, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAward}
                disabled={awarding}
                className="btn-primary"
                style={{ flex: 1, padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}
              >
                {awarding ? "Guardando…" : `Otorgar ${awardPoints} punto${awardPoints !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};