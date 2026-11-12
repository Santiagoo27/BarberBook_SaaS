import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { appointmentService } from "./appointmentService";
import { barberService } from "../barbers/barberService";
import { serviceService } from "../services/serviceService";
import { useLocations } from "../../hooks/useLocations";
import { LocationSelector } from "../locations/LocationSelector";
import type { Appointment, AppointmentStatus } from "./appointmentTypes";
import type { Barber } from "../barbers/barberTypes";
import type { Service } from "../services/serviceTypes";
import { RefreshCw, Check, X, Trash2, CalendarDays, LayoutGrid, AlignJustify, CheckSquare } from "lucide-react";

/* ── Status tokens ─────────────────────────────────────────── */
const STATUS: Record<AppointmentStatus, {
  bg: string; text: string; dot: string; border: string;
  cardBorder: string; accent: string;
}> = {
  Pendiente: {
    bg: "rgba(245,158,11,0.10)", text: "#f59e0b", dot: "#f59e0b",
    border: "rgba(245,158,11,0.30)", cardBorder: "rgba(245,158,11,0.22)", accent: "#f59e0b",
  },
  Completada: {
    bg: "rgba(16,185,129,0.10)", text: "#34d399", dot: "#10b981",
    border: "rgba(16,185,129,0.30)", cardBorder: "rgba(16,185,129,0.22)", accent: "#10b981",
  },
  Cancelada: {
    bg: "rgba(239,68,68,0.10)", text: "#f87171", dot: "#ef4444",
    border: "rgba(239,68,68,0.30)", cardBorder: "rgba(239,68,68,0.22)", accent: "#ef4444",
  },
};

/* ── Portal modal constants ─────────────────────────────────── */
const BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
};
const PANEL: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)", borderRadius: "20px",
};
/* ── Avatar palette ─────────────────────────────────────────── */
const AVATARS = [
  { bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)", color: "var(--color-primary)",                               border: "color-mix(in srgb, var(--color-primary) 30%, transparent)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)", border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)" },
  { bg: "rgba(16,185,129,0.18)",  color: "#34d399", border: "rgba(16,185,129,0.30)" },
  { bg: "rgba(245,158,11,0.18)",  color: "#f59e0b", border: "rgba(245,158,11,0.30)" },
];

const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const p = AVATARS[name.charCodeAt(0) % 4];
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "16px", fontWeight: 700,
      background: p.bg, color: p.color, border: `1px solid ${p.border}`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const StatusPill: React.FC<{ status: AppointmentStatus }> = ({ status }) => {
  const s = STATUS[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap",
      fontSize: "11px", fontWeight: 600,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0, display: "block" }} />
      {status}
    </span>
  );
};

/* ── Month names ────────────────────────────────────────────── */
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DAY_NAMES_ES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

/* ── Agenda row ─────────────────────────────────────────────── */
interface AgendaRowProps {
  app: Appointment;
  idx: number;
  barbers: Barber[];
  services: Service[];
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  selectionMode: boolean;
}

const AgendaRow: React.FC<AgendaRowProps> = ({ app, idx, barbers, services, onStatusChange, onDelete, selectedIds, onToggleSelect, selectionMode }) => {
  const dispTime = app.appointmentDate.split("T")[1]?.substring(0, 5) ?? "";
  const cfg = STATUS[app.status];
  const isPending  = app.status === "Pendiente";
  const isTerminal = app.status === "Completada" || app.status === "Cancelada";
  const barberName  = app.barber?.name  ?? barbers.find(b => b.id === app.barberId)?.name  ?? "—";
  const serviceName = app.service?.name ?? services.find(s => s.id === app.serviceId)?.name ?? "—";

  return (
    <div
      className="fade-up agenda-row"
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "15px 20px",
        borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
        transition: "background 150ms ease",
        animationDelay: `${Math.min(idx * 30, 200)}ms`,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--color-glass-surface-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {selectionMode && isTerminal && (
        <input
          type="checkbox"
          checked={selectedIds.has(app.id)}
          onChange={() => onToggleSelect(app.id)}
          style={{ width: 15, height: 15, flexShrink: 0, accentColor: "var(--color-primary)", cursor: "pointer" }}
        />
      )}
      <Avatar name={app.customerName} />

      {/* Customer name + phone */}
      <div className="agenda-row-customer" style={{ flex: "0 0 165px", minWidth: 0 }}>
        <p style={{
          color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
          letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          {app.customerName}
          {app.isWalkIn && (
            <span style={{
              fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "5px",
              background: "rgba(168,85,247,0.12)", color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.25)", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              Sin cita
            </span>
          )}
        </p>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginTop: "1px" }}>
          {app.customerPhone || "Sin teléfono"}
        </p>
        {app.customerLoyaltyEnabled && app.customerLoyaltyCount != null && app.customerLoyaltyThreshold != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <div style={{
              flex: 1, height: 4, borderRadius: 2, maxWidth: 60,
              background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 2,
                background: app.customerLoyaltyCount >= app.customerLoyaltyThreshold ? "#10b981" : "var(--color-primary)",
                width: `${Math.min(100, Math.round((app.customerLoyaltyCount / app.customerLoyaltyThreshold) * 100))}%`,
              }} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              color: app.customerLoyaltyCount >= app.customerLoyaltyThreshold ? "#10b981" : "var(--color-text-muted)",
            }}>
              {app.customerLoyaltyCount >= app.customerLoyaltyThreshold
                ? "Corte gratis"
                : `${app.customerLoyaltyCount}/${app.customerLoyaltyThreshold}`
              }
            </span>
          </div>
        )}
      </div>

      {/* Barber · Service */}
      <div className="agenda-row-middle" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{barberName}</span>
          <span style={{ margin: "0 6px", opacity: 0.4 }}>·</span>
          {serviceName}
        </p>
        {app.status === "Cancelada" && app.cancelledBy && (
          <p style={{ fontSize: "10px", fontWeight: 600, color: "#ef4444", marginTop: "2px" }}>
            Cancelada por {app.cancelledBy === "customer" ? "el cliente" : app.cancelledBy === "barber" ? "el barbero" : "el dueño"}
          </p>
        )}
      </div>

      {/* Time */}
      <span className="agenda-row-time" style={{
        color: cfg.text, fontWeight: 700, fontSize: "14px", flexShrink: 0,
        fontVariantNumeric: "tabular-nums", fontFamily: "monospace", minWidth: 40,
      }}>
        {dispTime}
      </span>

      <span className="agenda-row-status"><StatusPill status={app.status} /></span>

      {/* Action buttons */}
      <div className="agenda-row-actions" style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
        {isPending && (
          <>
            <button
              onClick={() => onStatusChange(app.id, "Completada")}
              title="Completar"
              style={{
                width: 28, height: 28, borderRadius: "7px", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                background: "rgba(16,185,129,0.12)", color: "#10b981",
                transition: "background 150ms ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.24)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.12)")}
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => onStatusChange(app.id, "Cancelada")}
              title="Cancelar"
              style={{
                width: 28, height: 28, borderRadius: "7px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                background: "transparent", color: "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text-muted)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
            >
              <X size={12} />
            </button>
          </>
        )}
        {isTerminal && !selectionMode && (
          <button
            onClick={() => onDelete(app.id)}
            title="Eliminar registro"
            style={{
              width: 28, height: 28, borderRadius: "7px", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
              background: "transparent", color: "var(--color-text-muted)",
              transition: "all 150ms ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.10)"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

/* ── Main component ─────────────────────────────────────────── */
export const AppointmentManagement: React.FC = () => {
  const { locations, hasMultipleLocations } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers]           = useState<Barber[]>([]);
  const [services, setServices]         = useState<Service[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState<AppointmentStatus | "Todas">("Todas");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"cards" | "agenda">(() =>
    (localStorage.getItem("appt_view_mode") as "cards" | "agenda") ?? "cards"
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [appData, barberData, serviceData] = await Promise.all([
        appointmentService.getAll().catch(() => []),
        barberService.getAll().catch(() => []),
        serviceService.getAll().catch(() => []),
      ]);
      setAppointments(appData);
      setBarbers(barberData);
      setServices(serviceData);
      setLastRefreshed(new Date());
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const pollAppointments = useCallback(async () => {
    if (document.hidden) return;
    const data = await appointmentService.getAll().catch(() => []);
    setAppointments(data);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(pollAppointments, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadData, pollAppointments]);

  const handleStatusChange = (id: string, newStatus: AppointmentStatus) => {
    const prev = appointments;
    setAppointments(cur => cur.map(a =>
      a.id === id ? { ...a, status: newStatus, cancelledBy: newStatus === "Cancelada" ? "admin" : a.cancelledBy } : a
    ));
    appointmentService.updateStatus(id, newStatus).then(updated => {
      setAppointments(cur => cur.map(a =>
        a.id === id ? { ...a, status: updated.status, cancelledBy: updated.cancelledBy } : a
      ));
    }).catch(() => {
      setAppointments(prev);
      alert("Error al actualizar el estado.");
    });
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    const prev = appointments;
    setAppointments(cur => cur.filter(a => a.id !== id));
    setSelectedIds(cur => { const s = new Set(cur); s.delete(id); return s; });
    setDeleteTargetId(null);
    appointmentService.delete(id).catch(() => {
      setAppointments(prev);
      alert("Error al eliminar la cita.");
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(cur => {
      const s = new Set(cur);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setBulkDeleting(true);
    const prev = appointments;
    setAppointments(cur => cur.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    setSelectionMode(false);
    try {
      await appointmentService.bulkDelete(ids);
    } catch {
      setAppointments(prev);
      alert("Error al eliminar los registros.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleView = (mode: "cards" | "agenda") => {
    setViewMode(mode);
    localStorage.setItem("appt_view_mode", mode);
  };

  const locationFiltered = hasMultipleLocations && selectedLocationId
    ? appointments.filter(a => a.locationId === selectedLocationId)
    : appointments;
  const filtered = locationFiltered.filter(a => filterStatus === "Todas" || a.status === filterStatus);

  const terminalIds = filtered
    .filter(a => a.status === "Completada" || a.status === "Cancelada")
    .map(a => a.id);
  const allTerminalSelected = terminalIds.length > 0 && terminalIds.every(id => selectedIds.has(id));
  const toggleSelectAll = () => {
    allTerminalSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(terminalIds));
  };
  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
  })();
  const formatCardDate = (datePart: string) => {
    const d = new Date(datePart + "T12:00:00");
    const abbr = ["dom","lun","mar","mié","jue","vie","sáb"][d.getDay()];
    return `${abbr} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  };

  const counts: Record<AppointmentStatus | "Todas", number> = {
    Todas:      locationFiltered.length,
    Pendiente:  locationFiltered.filter(a => a.status === "Pendiente").length,
    Completada: locationFiltered.filter(a => a.status === "Completada").length,
    Cancelada:  locationFiltered.filter(a => a.status === "Cancelada").length,
  };

  const FILTERS: Array<{ key: AppointmentStatus | "Todas"; label: string }> = [
    { key: "Todas",      label: "Todas" },
    { key: "Pendiente",  label: "Pendientes" },
    { key: "Completada", label: "Completadas" },
    { key: "Cancelada",  label: "Canceladas" },
  ];

  /* Agenda grouping */
  const agendaGroups: Record<string, Appointment[]> = {};
  filtered.forEach(app => {
    const dk = app.appointmentDate.split("T")[0];
    if (!agendaGroups[dk]) agendaGroups[dk] = [];
    agendaGroups[dk].push(app);
  });
  const sortedDates = Object.keys(agendaGroups).sort((a, b) => {
    if (a === today) return -1;
    if (b === today) return 1;
    const aFuture = a > today;
    const bFuture = b > today;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    if (aFuture && bFuture) return a.localeCompare(b);
    return b.localeCompare(a);
  });

  const VIEW_OPTIONS: Array<{ mode: "cards" | "agenda"; icon: React.ReactNode; label: string }> = [
    { mode: "cards",  icon: <LayoutGrid size={12} />,    label: "Tarjetas" },
    { mode: "agenda", icon: <AlignJustify size={12} />,  label: "Agenda" },
  ];

  return (
    <div className="space-y-6 fade-up">

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: 4, height: 32, borderRadius: 99, flexShrink: 0,
              background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
            }} />
            <h1 style={{
              color: "var(--color-text)", fontSize: "30px",
              fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
            }}>
              Gestión de Citas
            </h1>
          </div>
          <p style={{
            color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.12em", marginLeft: "16px",
          }}>
            Actualizado {lastRefreshed.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        <div className="appt-header-actions" style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
          {hasMultipleLocations && (
            <LocationSelector
              locations={locations}
              selectedLocationId={selectedLocationId}
              onChange={setSelectedLocationId}
            />
          )}
          {selectionMode ? (
            <>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "8px 14px", borderRadius: "10px",
                    fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    background: "rgba(239,68,68,0.12)", color: "#f87171",
                    border: "1px solid rgba(239,68,68,0.28)",
                    transition: "all 150ms ease",
                    opacity: bulkDeleting ? 0.6 : 1,
                  }}
                >
                  <Trash2 size={13} /> Eliminar {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
                </button>
              )}
              <button
                onClick={toggleSelectAll}
                className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <CheckSquare size={13} /> {allTerminalSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button
                onClick={exitSelectionMode}
                className="btn-ghost"
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
              >
                <X size={13} /> Cancelar
              </button>
            </>
          ) : terminalIds.length > 0 ? (
            <button
              onClick={() => setSelectionMode(true)}
              className="btn-ghost"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              <CheckSquare size={13} /> Seleccionar
            </button>
          ) : null}
          <button
            onClick={() => loadData()}
            className="btn-ghost"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RefreshCw size={13} /> Actualizar
          </button>

          {/* View mode toggle */}
          <div style={{
            display: "inline-flex", gap: "2px", padding: "3px", borderRadius: "10px",
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          }}>
            {VIEW_OPTIONS.map(({ mode, icon, label }) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => toggleView(mode)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "5px 10px", borderRadius: "7px",
                    fontSize: "11px", fontWeight: 600, cursor: "pointer",
                    border: "none", transition: "all 150ms ease",
                    background: isActive
                      ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                      : "transparent",
                    color: isActive ? "#000" : "var(--color-text-muted)",
                    boxShadow: isActive ? "0 2px 8px color-mix(in srgb, var(--color-primary) 38%, transparent)" : "none",
                  }}
                >
                  {icon} {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────── */}
      <div className="appt-filter-bar" style={{
        display: "inline-flex", gap: "4px", padding: "4px", borderRadius: "14px",
        background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
      }}>
        {FILTERS.map(f => {
          const isActive = filterStatus === f.key;
          const cnt = counts[f.key];
          return (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 12px", borderRadius: "10px",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                border: "1px solid transparent",
                transition: "all 150ms cubic-bezier(0.16,1,0.3,1)",
                background: isActive
                  ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                  : "transparent",
                color: isActive ? "#000" : "var(--color-text-muted)",
                boxShadow: isActive ? "0 2px 8px color-mix(in srgb, var(--color-primary) 38%, transparent)" : "none",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "var(--color-glass-surface-hover)";
                  e.currentTarget.style.color = "var(--color-text)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--color-text-muted)";
                }
              }}
            >
              {f.label}
              {!loading && cnt > 0 && (
                <span style={{
                  fontSize: "10px", fontWeight: 700,
                  padding: "1px 5px", borderRadius: "5px", lineHeight: "16px",
                  background: isActive ? "rgba(0,0,0,0.18)" : "var(--color-glass-surface)",
                  color: isActive ? "#000" : "var(--color-text-muted)",
                  border: isActive ? "none" : "1px solid var(--color-glass-border)",
                  minWidth: 16, textAlign: "center",
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {loading ? (
        <div className="appt-grid">
          {[0,1,2,3,4,5].map(i => (
            <div
              key={i}
              className="skeleton-shimmer fade-up"
              style={{ height: 212, borderRadius: 16, animationDelay: `${i * 55}ms` }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="fade-up"
          style={{
            borderRadius: "20px", padding: "72px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            background: "var(--color-glass-surface)",
            border: "1px dashed var(--color-glass-border)",
            animationDelay: "60ms",
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: "14px", marginBottom: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
            color: "var(--color-primary)",
          }}>
            <CalendarDays size={20} />
          </div>
          <p style={{ color: "var(--color-text)", fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            {filterStatus === "Todas"
              ? "Sin citas registradas"
              : `Sin citas ${filterStatus === "Pendiente" ? "pendientes" : filterStatus === "Completada" ? "completadas" : "canceladas"}`}
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "12px", maxWidth: 300 }}>
            {filterStatus === "Todas"
              ? "Las citas aparecerán aquí una vez que sean agendadas."
              : "Cambia el filtro para ver otros estados."}
          </p>
        </div>
      ) : viewMode === "cards" ? (

        /* ── Card grid ────────────────────────────────────────── */
        <div className="appt-grid">
          {filtered.map((app, idx) => {
            const [dispDate, dispTime] = app.appointmentDate.split("T");
            const cfg = STATUS[app.status];
            const isPending  = app.status === "Pendiente";
            const isTerminal = app.status === "Completada" || app.status === "Cancelada";
            return (
              <div
                key={app.id}
                className="fade-up"
                style={{
                  borderRadius: "16px", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  background: "var(--color-glass-surface)",
                  border: `1px solid ${cfg.cardBorder}`,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                  transition: "box-shadow 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)",
                  animationDelay: `${Math.min(idx * 45, 320)}ms`,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 10px 32px rgba(0,0,0,0.24)";
                  el.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)";
                  el.style.transform = "";
                }}
              >
                <div style={{ height: 2, background: cfg.accent, flexShrink: 0 }} />

                <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: "14px" }}>
                  {selectionMode && isTerminal && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                      style={{ width: 15, height: 15, flexShrink: 0, accentColor: "var(--color-primary)", cursor: "pointer", marginTop: 2 }}
                    />
                  )}
                  <Avatar name={app.customerName} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
                      letterSpacing: "-0.01em", lineHeight: 1.3,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}>
                      {app.customerName}
                      {app.isWalkIn && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "5px",
                          background: "rgba(168,85,247,0.12)", color: "#a855f7",
                          border: "1px solid rgba(168,85,247,0.25)", whiteSpace: "nowrap", flexShrink: 0,
                        }}>
                          Sin cita
                        </span>
                      )}
                    </p>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginTop: "3px" }}>
                      {app.customerPhone || "Sin teléfono"}
                    </p>
                    {app.customerLoyaltyEnabled && app.customerLoyaltyCount != null && app.customerLoyaltyThreshold != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <div style={{
                          flex: 1, height: 4, borderRadius: 2, maxWidth: 60,
                          background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                          overflow: "hidden",
                        }}>
                          <div style={{
                            height: "100%", borderRadius: 2,
                            background: app.customerLoyaltyCount >= app.customerLoyaltyThreshold ? "#10b981" : "var(--color-primary)",
                            width: `${Math.min(100, Math.round((app.customerLoyaltyCount / app.customerLoyaltyThreshold) * 100))}%`,
                          }} />
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          color: app.customerLoyaltyCount >= app.customerLoyaltyThreshold ? "#10b981" : "var(--color-text-muted)",
                        }}>
                          {app.customerLoyaltyCount >= app.customerLoyaltyThreshold
                            ? "Corte gratis"
                            : `${app.customerLoyaltyCount}/${app.customerLoyaltyThreshold}`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <StatusPill status={app.status} />
                </div>

                <div style={{
                  margin: "0 14px 12px", borderRadius: "10px", padding: "12px 14px",
                  background: "color-mix(in srgb, var(--color-bg) 65%, var(--color-glass-surface))",
                  border: "1px solid var(--color-glass-border)",
                  display: "flex", flexDirection: "column", gap: "9px",
                }}>
                  {[
                    { label: "Barbero",  value: app.barber?.name  ?? barbers.find(b => b.id === app.barberId)?.name  ?? "—" },
                    { label: "Servicio", value: app.service?.name ?? services.find(s => s.id === app.serviceId)?.name ?? "—" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <span style={{ color: "var(--color-text-muted)", fontWeight: 500, minWidth: 56, flexShrink: 0 }}>{row.label}</span>
                      <span style={{ color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                    <span style={{ color: "var(--color-text-muted)", fontWeight: 500, minWidth: 56, flexShrink: 0 }}>Horario</span>
                    <span style={{ color: cfg.text, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                      {formatCardDate(dispDate)} · {dispTime?.substring(0, 5)}
                    </span>
                  </div>
                  {app.status === "Cancelada" && app.cancelledBy && (
                    <p style={{ fontSize: "10px", fontWeight: 600, color: "#ef4444", marginTop: "1px" }}>
                      Cancelada por{" "}
                      {app.cancelledBy === "customer" ? "el cliente" : app.cancelledBy === "barber" ? "el barbero" : "el dueño"}
                    </p>
                  )}
                </div>

                <div style={{ padding: "0 12px 12px", marginTop: "auto" }}>
                  {isPending && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleStatusChange(app.id, "Completada")}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                          padding: "7px 0", fontSize: "11px", fontWeight: 700, borderRadius: "8px", cursor: "pointer",
                          background: "rgba(16,185,129,0.12)", color: "#10b981",
                          border: "1px solid rgba(16,185,129,0.25)",
                          transition: "background 150ms ease",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.22)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.12)")}
                      >
                        <Check size={11} /> Completar
                      </button>
                      <button
                        onClick={() => handleStatusChange(app.id, "Cancelada")}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                          padding: "7px 0", fontSize: "11px", fontWeight: 600, borderRadius: "8px", cursor: "pointer",
                          background: "transparent", color: "var(--color-text-muted)",
                          border: "1px solid var(--color-border)",
                          transition: "all 150ms ease",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text-muted)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                      >
                        <X size={11} /> Cancelar
                      </button>
                    </div>
                  )}
                  {isTerminal && !selectionMode && (
                    <button
                      onClick={() => setDeleteTargetId(app.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                        padding: "7px 0", fontSize: "11px", fontWeight: 500, borderRadius: "8px", cursor: "pointer",
                        color: "var(--color-text-muted)", background: "transparent", border: "none",
                        transition: "all 150ms ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <Trash2 size={11} /> Eliminar registro
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* ── Agenda view ──────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {sortedDates.map((dk, gIdx) => {
            const dayApps = [...agendaGroups[dk]].sort((a, b) =>
              a.appointmentDate.localeCompare(b.appointmentDate)
            );
            const d = new Date(dk + "T12:00:00");
            const rawDayName = DAY_NAMES_ES[d.getDay()];
            const dayLabel = dk === today ? "Hoy" : rawDayName.charAt(0).toUpperCase() + rawDayName.slice(1);
            const dateFormatted = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
            const isPast = dk < today;

            return (
              <div
                key={dk}
                className="fade-up"
                style={{
                  borderRadius: "16px", overflow: "hidden",
                  background: "var(--color-glass-surface)",
                  border: "1px solid var(--color-glass-border)",
                  opacity: isPast ? 0.6 : 1,
                  transition: "opacity 200ms ease",
                  animationDelay: `${Math.min(gIdx * 60, 300)}ms`,
                }}
              >
                {/* Day group header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--color-glass-border)",
                  background: "color-mix(in srgb, var(--color-bg) 55%, var(--color-glass-surface))",
                }}>
                  {dk === today && (
                    <span
                      className="pulse-dot"
                      style={{
                        display: "block", width: 7, height: 7,
                        borderRadius: "50%", flexShrink: 0,
                        background: "var(--color-primary)",
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "var(--color-text)", fontSize: "14px", fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {dayLabel}
                    </span>
                    <span style={{ color: "var(--color-text-muted)", fontSize: "13px", marginLeft: "8px" }}>
                      · {dateFormatted}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 9px", borderRadius: "6px",
                    background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color: "var(--color-primary)",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
                  }}>
                    {dayApps.length} cita{dayApps.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Rows */}
                {dayApps.map((app, idx) => (
                  <AgendaRow
                    key={app.id}
                    app={app}
                    idx={idx}
                    barbers={barbers}
                    services={services}
                    onStatusChange={handleStatusChange}
                    onDelete={setDeleteTargetId}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: confirmar borrado ─────────────────────────── */}
      {deleteTargetId && createPortal(
        <div style={BACKDROP}>
          <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: "380px", padding: "28px" }}>
            <h3 style={{ color: "var(--color-text)", fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
              Eliminar registro
            </h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginBottom: "24px", lineHeight: 1.5 }}>
              Esta acción es permanente y no podrá recuperarse.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setDeleteTargetId(null)}
                className="btn-ghost"
                style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 700, color: "#fff",
                  background: "#dc2626", border: "none", cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#b91c1c")}
                onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};