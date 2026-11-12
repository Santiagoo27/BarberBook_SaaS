import React, { useEffect, useState } from "react";
import { suggestionService, type Suggestion } from "./suggestionService";
import { MessageSquare, AlertTriangle, Lightbulb, Check, Trash2 } from "lucide-react";

const TYPE_CONFIG = {
  queja:      { label: "Queja",      icon: <AlertTriangle size={14} />, color: "#f87171", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)" },
  sugerencia: { label: "Sugerencia", icon: <Lightbulb size={14} />,     color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
};

export const SuggestionsPage: React.FC = () => {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "queja" | "sugerencia">("all");

  const load = async () => {
    setLoading(true);
    try { setItems(await suggestionService.getAll()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRead = async (id: string) => {
    await suggestionService.markAsRead(id);
    setItems(prev => prev.map(s => s.id === id ? { ...s, status: "Leída" } : s));
  };

  const handleDelete = async (id: string) => {
    await suggestionService.delete(id);
    setItems(prev => prev.filter(s => s.id !== id));
  };

  const filtered = filter === "all" ? items : items.filter(s => s.type === filter);
  const pendingCount = items.filter(s => s.status === "Pendiente").length;
  const quejaCount = items.filter(s => s.type === "queja").length;
  const sugerenciaCount = items.filter(s => s.type === "sugerencia").length;

  return (
    <div className="fade-up dashboard-mobile-compact" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 860 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "var(--color-text)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>
          Quejas y Sugerencias
        </h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
          {items.length} mensaje{items.length !== 1 ? "s" : ""} · {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {[
          { label: "Total", value: items.length, color: "var(--color-primary)", icon: <MessageSquare size={16} /> },
          { label: "Quejas", value: quejaCount, color: "#f87171", icon: <AlertTriangle size={16} /> },
          { label: "Sugerencias", value: sugerenciaCount, color: "#a78bfa", icon: <Lightbulb size={16} /> },
        ].map(s => (
          <div key={s.label} className="stat-card-compact" style={{
            padding: "20px 18px", borderRadius: 16,
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color,
            }}>{s.icon}</div>
            <div>
              <p className="stat-label" style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{s.label}</p>
              <p className="stat-number" style={{ fontSize: 32, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1, marginTop: 4 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{
        display: "inline-flex", gap: 2, padding: 3, borderRadius: 10,
        background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)", alignSelf: "flex-start",
      }}>
        {([["all", "Todos"], ["queja", "Quejas"], ["sugerencia", "Sugerencias"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "5px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "none", transition: "all 150ms",
              background: filter === key
                ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                : "transparent",
              color: filter === key ? "#000" : "var(--color-text-muted)",
            }}
          >{label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "block" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", borderRadius: 16,
          background: "var(--color-glass-surface)", border: "1px dashed var(--color-glass-border)",
        }}>
          <MessageSquare size={32} style={{ color: "var(--color-text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No hay mensajes aún.</p>
        </div>
      ) : (
        <div style={{ borderRadius: 16, overflow: "hidden", background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)" }}>
          {filtered.map((s, idx) => {
            const cfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.sugerencia;
            const isUnread = s.status === "Pendiente";
            return (
              <div key={s.id} style={{
                padding: "16px 20px", display: "flex", gap: 14, alignItems: "flex-start",
                borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
                background: isUnread ? "color-mix(in srgb, var(--color-primary) 3%, transparent)" : "transparent",
                transition: "background 150ms",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, flexShrink: 0, marginTop: 2,
                }}>{cfg.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{s.customerName}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                    }}>{cfg.label}</span>
                    {isUnread && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                        color: "var(--color-primary)",
                        border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                      }}>Nueva</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}>{s.message}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", opacity: 0.6, marginTop: 6 }}>
                    {new Date(s.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {isUnread && (
                    <button onClick={() => handleRead(s.id)} title="Marcar como leída" style={{
                      width: 30, height: 30, borderRadius: 7, border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(16,185,129,0.12)", color: "#10b981", cursor: "pointer", transition: "background 150ms",
                    }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.24)")}
                       onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.12)")}>
                      <Check size={13} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(s.id)} title="Eliminar" style={{
                    width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(239,68,68,0.06)", color: "#f87171", cursor: "pointer", transition: "background 150ms",
                  }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                     onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
