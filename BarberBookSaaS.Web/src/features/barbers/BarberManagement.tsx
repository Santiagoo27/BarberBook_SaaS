import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { barberService } from "./barberService";
import { useAuth } from "../../context/AuthContext";
import { useLocations } from "../../hooks/useLocations";
import { LocationSelector } from "../locations/LocationSelector";
import type { Barber, BarberScheduleEntry } from "./barberTypes";
import { Plus, Clock, Pencil, Copy, Check, UserCheck, Users, UserX, ImagePlus, Trash2 } from "lucide-react";
import { dashboardService, type BarberEarnings } from "../dashboard/dashboardService";

type EarningsPeriod = 7 | 15 | 30;

interface NewCredentials { email: string; password: string; barber: Barber; }

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const TIME_OPTIONS = HOURS.flatMap(h => [
  { label: `${String(h).padStart(2,"0")}:00`, hour: h, minute: 0 },
  { label: `${String(h).padStart(2,"0")}:30`, hour: h, minute: 30 },
]);

interface ScheduleDayState {
  active: boolean;
  startHour: number; startMinute: number;
  endHour: number; endMinute: number;
  breakEnabled: boolean;
  breakStartHour: number; breakStartMinute: number;
  breakEndHour: number; breakEndMinute: number;
}
const defaultDay = (): ScheduleDayState => ({
  active: false,
  startHour: 9, startMinute: 0,
  endHour: 18, endMinute: 0,
  breakEnabled: false,
  breakStartHour: 13, breakStartMinute: 0,
  breakEndHour: 14, breakEndMinute: 0,
});
type ActiveModal = "edit" | "schedule" | "deactivate" | "delete" | null;

const BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0,
  backgroundColor: "rgba(0,0,0,0.72)",
  zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  backdropFilter: "blur(2px)",
};
const SCROLL_BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0,
  backgroundColor: "rgba(0,0,0,0.72)",
  zIndex: 9999, overflowY: "auto",
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

/* ── Copy row ──────────────────────────────────────────── */
const CredentialRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 13, color: "var(--color-text)", margin: "2px 0 0", wordBreak: "break-all", fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 700 : 600 }}>{value}</p>
      </div>
      <button
        onClick={copy}
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
          fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 600,
          border: "1px solid var(--color-glass-border)", background: "transparent",
          color: "var(--color-text-muted)", cursor: "pointer", transition: "color 150ms ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        {copied ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
      </button>
    </div>
  );
};

/* ── Avatar ────────────────────────────────────────────── */
const AVATAR_PALETTES = [
  { bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)", color: "var(--color-primary)", border: "color-mix(in srgb, var(--color-primary) 30%, transparent)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)", border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)" },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
];

function getAvatarPalette(name: string) {
  return AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
}

const BarberAvatar: React.FC<{ name: string; size?: number; imageBase64?: string | null }> = ({ name, size = 36, imageBase64 }) => {
  const p = getAvatarPalette(name);
  if (imageBase64) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: `1.5px solid ${p.border}` }}>
        <img src={imageBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.36), fontWeight: 700,
      background: p.bg, color: p.color, border: `1.5px solid ${p.border}`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

/* ── Day toggle switch ─────────────────────────────────── */
const DayToggle: React.FC<{ active: boolean; onChange: (v: boolean) => void }> = ({ active, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    style={{
      width: 36, height: 20, borderRadius: 10, flexShrink: 0,
      background: active ? "var(--color-primary)" : "var(--color-glass-border)",
      position: "relative", border: "none", cursor: "pointer",
      transition: "background 200ms ease", padding: 0,
    }}
  >
    <span style={{
      position: "absolute", top: 3,
      left: active ? 19 : 3,
      width: 14, height: 14, borderRadius: "50%",
      background: "#fff",
      transition: "left 200ms cubic-bezier(0.16,1,0.3,1)",
      display: "block",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    }} />
  </button>
);

const formatCOP = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
};

/* ── Barber card ───────────────────────────────────────── */
interface BarberCardProps {
  barber: Barber;
  idx: number;
  earnings?: BarberEarnings;
  earningsLoading: boolean;
  onEdit: () => void;
  onSchedule: () => void;
  onDeactivate: () => void;
  onActivate: () => void;
  onDelete: () => void;
}

const BarberCard: React.FC<BarberCardProps> = ({ barber, idx, earnings, earningsLoading, onEdit, onSchedule, onDeactivate, onActivate, onDelete }) => (
  <div
    className="fade-up"
    style={{
      animationDelay: `${idx * 55}ms`,
      background: "var(--color-glass-surface)",
      border: "1px solid var(--color-glass-border)",
      borderRadius: 16,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      transition: "transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms cubic-bezier(0.16,1,0.3,1)",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.22)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    {/* Top: avatar + name + badges */}
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <BarberAvatar name={barber.name} size={44} imageBase64={barber.imageBase64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>{barber.name}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
            letterSpacing: "0.06em", textTransform: "uppercase" as const,
            background: barber.isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
            color: barber.isActive ? "#34d399" : "#f87171",
          }}>
            {barber.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        {barber.specialty && (
          <span style={{
            fontSize: 11, fontWeight: 600, display: "inline-block", marginTop: 4,
            padding: "2px 8px", borderRadius: 6,
            background: "color-mix(in srgb, var(--color-secondary) 12%, transparent)",
            color: "var(--color-secondary)",
          }}>
            {barber.specialty}
          </span>
        )}
      </div>
    </div>

    {/* Divider */}
    <div style={{ height: 1, background: "var(--color-glass-border)" }} />

    {/* Contact info */}
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {barber.email || <em style={{ opacity: 0.45, fontStyle: "italic" }}>Sin correo</em>}
      </p>
    </div>

    {/* Earnings strip */}
    {earningsLoading ? (
      <div className="skeleton-shimmer" style={{ height: 36, borderRadius: 10 }} />
    ) : (
      <div style={{
        display: "flex", gap: 8,
        padding: "10px 12px", borderRadius: 10,
        background: "color-mix(in srgb, var(--color-primary) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)",
      }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary)", margin: 0, lineHeight: 1 }}>
            {formatCOP(earnings?.revenue ?? 0)}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "3px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ingresos
          </p>
        </div>
        <div style={{ width: 1, background: "color-mix(in srgb, var(--color-primary) 18%, transparent)" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0, lineHeight: 1 }}>
            {earnings?.completedAppointments ?? 0}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "3px 0 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Citas
          </p>
        </div>
      </div>
    )}

    {/* Action buttons */}
    <div style={{ display: "flex", gap: 6 }}>
      <button
        onClick={onSchedule}
        className="btn-ghost"
        style={{ flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}
      >
        <Clock size={11} /> Horario
      </button>
      <button
        onClick={onEdit}
        className="btn-ghost"
        style={{ flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" }}
      >
        <Pencil size={11} /> Editar
      </button>
      {barber.isActive ? (
        <button
          onClick={onDeactivate}
          style={{
            flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
            color: "#f87171", cursor: "pointer", transition: "background 150ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.14)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
        >
          <UserX size={11} /> Desactivar
        </button>
      ) : (
        <button
          onClick={onActivate}
          style={{
            flex: 1, fontSize: 11, padding: "6px 8px", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)",
            color: "#34d399", cursor: "pointer", transition: "background 150ms ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.14)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.06)")}
        >
          <UserCheck size={11} /> Activar
        </button>
      )}
      <button
        onClick={onDelete}
        title="Eliminar definitivamente"
        style={{
          flexShrink: 0, fontSize: 11, padding: "6px 8px", borderRadius: 8, width: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--color-border)", background: "transparent",
          color: "var(--color-text-muted)", cursor: "pointer", transition: "all 150ms ease",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  </div>
);

/* ── Main ──────────────────────────────────────────────── */
export const BarberManagement: React.FC = () => {
  const { tenantId } = useAuth();
  const { locations, hasMultipleLocations } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [barbers, setBarbers]               = useState<Barber[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [activeModal, setActiveModal]       = useState<ActiveModal>(null);
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast]                   = useState<string | null>(null);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [name, setName]                     = useState("");
  const [email, setEmail]                   = useState("");
  const [phone, setPhone]                   = useState("");
  const [specialty, setSpecialty]           = useState("");
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [currentImage, setCurrentImage]     = useState<string | null>(null);
  const [scheduleBarber, setScheduleBarber] = useState<Barber | null>(null);
  const [scheduleState, setScheduleState]   = useState<ScheduleDayState[]>(Array.from({ length: 7 }, defaultDay));
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleIsNew, setScheduleIsNew]   = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [formError, setFormError]           = useState<string | null>(null);

  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>(7);
  const [earningsMap, setEarningsMap]       = useState<Record<string, BarberEarnings>>({});
  const [earningsLoading, setEarningsLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const loadBarbers = async () => {
    try { setLoading(true); setError(null); setBarbers(await barberService.getAll()); }
    catch { setError("No se pudo cargar el equipo."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadBarbers(); }, []);

  useEffect(() => {
    setEarningsLoading(true);
    dashboardService.getBarberEarnings(earningsPeriod, selectedLocationId)
      .then(list => {
        const map: Record<string, BarberEarnings> = {};
        list.forEach(e => { map[e.barberId] = e; });
        setEarningsMap(map);
      })
      .catch(() => {})
      .finally(() => setEarningsLoading(false));
  }, [earningsPeriod, selectedLocationId]);

  const openModal = (barber?: Barber) => {
    if (barber) {
      setEditingId(barber.id); setName(barber.name); setEmail(barber.email);
      setPhone(barber.phone); setSpecialty(barber.specialty ?? "");
      setCurrentImage(barber.imageBase64 ?? null);
    } else {
      setEditingId(null); setName(""); setEmail(""); setPhone(""); setSpecialty("");
      setCurrentImage(null);
    }
    setImageFile(null); setImagePreview(null);
    setFormError(null);
    setActiveModal("edit");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const payload = { name, email, phone, specialty };
    try {
      if (editingId) {
        await barberService.update(editingId, payload);
        if (imageFile) await barberService.uploadImage(editingId, imageFile);
        setActiveModal(null); loadBarbers();
      } else {
        const { barber: newBarber, temporaryPassword } = await barberService.create(payload);
        if (imageFile) await barberService.uploadImage(newBarber.id, imageFile);
        setActiveModal(null); await loadBarbers();
        setNewCredentials({ email: payload.email, password: temporaryPassword, barber: newBarber });
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || "No se pudo guardar el barbero.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = (id: string) => { setPendingDeactivateId(id); setActiveModal("deactivate"); };

  const confirmDeactivate = async () => {
    if (!pendingDeactivateId) return;
    try {
      const { cancelledAppointments } = await barberService.delete(pendingDeactivateId);
      setActiveModal(null); setPendingDeactivateId(null); loadBarbers();
      const n = cancelledAppointments;
      showToast(n > 0
        ? `Barbero desactivado. Se cancelaron ${n} cita${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""}.`
        : "Barbero desactivado.");
    } catch { setError("Error al desactivar al barbero."); setActiveModal(null); setPendingDeactivateId(null); }
  };

  const handleActivate = async (id: string) => {
    try { await barberService.activate(id); loadBarbers(); showToast("Barbero reactivado."); }
    catch { setError("Error al activar al barbero."); }
  };

  const handleDelete = (id: string) => { setPendingDeleteId(id); setActiveModal("delete"); };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await barberService.hardDelete(pendingDeleteId);
      setActiveModal(null); setPendingDeleteId(null);
      loadBarbers();
      showToast("Barbero eliminado.");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      setError(axiosErr.response?.status === 409
        ? (axiosErr.response.data?.message ?? "No se puede eliminar este barbero.")
        : "Error al eliminar al barbero.");
      setActiveModal(null); setPendingDeleteId(null);
    }
  };

  const openScheduleModal = async (barber: Barber, isNew = false) => {
    setScheduleBarber(barber); setScheduleIsNew(isNew);
    const fresh: ScheduleDayState[] = Array.from({ length: 7 }, defaultDay);
    try {
      const entries: BarberScheduleEntry[] = await barberService.getSchedule(barber.id);
      entries.forEach(e => {
        const hasBreak = e.breakStartHour != null && e.breakEndHour != null;
        fresh[e.dayOfWeek] = {
          active: true,
          startHour: e.startHour, startMinute: e.startMinute,
          endHour: e.endHour, endMinute: e.endMinute,
          breakEnabled: hasBreak,
          breakStartHour: e.breakStartHour ?? 13, breakStartMinute: e.breakStartMinute ?? 0,
          breakEndHour: e.breakEndHour ?? 14, breakEndMinute: e.breakEndMinute ?? 0,
        };
      });
    } catch {}
    setScheduleState(fresh); setActiveModal("schedule");
  };

  const handleScheduleSave = async () => {
    if (!scheduleBarber) return;

    // Validate break windows before saving
    for (let day = 0; day < 7; day++) {
      const s = scheduleState[day];
      if (s.active && s.breakEnabled) {
        const breakStartMins = s.breakStartHour * 60 + s.breakStartMinute;
        const breakEndMins = s.breakEndHour * 60 + s.breakEndMinute;
        if (breakEndMins <= breakStartMins) {
          setError(`El descanso del ${DAY_NAMES[day]} debe terminar después de comenzar (${String(s.breakStartHour).padStart(2,"0")}:${String(s.breakStartMinute).padStart(2,"0")} → fin debe ser mayor).`);
          return;
        }
      }
    }

    setSavingSchedule(true);
    try {
      for (let day = 0; day < 7; day++) {
        const s = scheduleState[day];
        if (s.active) {
          await barberService.upsertScheduleDay(scheduleBarber.id, {
            dayOfWeek: day,
            startHour: s.startHour, startMinute: s.startMinute,
            endHour: s.endHour, endMinute: s.endMinute,
            breakStartHour: s.breakEnabled ? s.breakStartHour : null,
            breakStartMinute: s.breakEnabled ? s.breakStartMinute : null,
            breakEndHour: s.breakEnabled ? s.breakEndHour : null,
            breakEndMinute: s.breakEnabled ? s.breakEndMinute : null,
          });
        } else {
          await barberService.deleteScheduleDay(scheduleBarber.id, day);
        }
      }
      setActiveModal(null);
    } catch { setError("Error al guardar el horario."); }
    finally { setSavingSchedule(false); }
  };

  const updateDay = (day: number, patch: Partial<ScheduleDayState>) => {
    setScheduleState(prev => { const next = [...prev]; next[day] = { ...next[day], ...patch }; return next; });
  };

  const displayedBarbers = hasMultipleLocations && selectedLocationId
    ? barbers.filter(b => b.locationId === selectedLocationId)
    : barbers;

  return (
    <div>

      {/* ── Header ──────────────────────────────────────── */}
      <div
        className="fade-up"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2.5rem", flexWrap: "wrap", rowGap: "1rem" }}
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{
            width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
            background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
          }} />
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>
              Equipo de barberos
            </h1>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", margin: "6px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {barbers.length} profesional{barbers.length !== 1 ? "es" : ""} en el equipo
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 4, padding: "3px", borderRadius: 10, background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)" }}>
            {([7, 15, 30] as EarningsPeriod[]).map(d => (
              <button
                key={d}
                onClick={() => setEarningsPeriod(d)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer",
                  transition: "all 150ms ease",
                  background: earningsPeriod === d ? "var(--color-primary)" : "transparent",
                  color: earningsPeriod === d ? "var(--color-bg)" : "var(--color-text-muted)",
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          {hasMultipleLocations && (
            <LocationSelector
              locations={locations}
              selectedLocationId={selectedLocationId}
              onChange={setSelectedLocationId}
            />
          )}
          <button
            onClick={() => openModal()}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}
          >
            <Plus size={14} /> Nuevo barbero
          </button>
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

      {/* ── Card grid ───────────────────────────────────── */}
      {loading ? (
        <div className="barber-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 168, borderRadius: 16 }} />
          ))}
        </div>
      ) : displayedBarbers.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          padding: "72px 24px",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={22} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
              {barbers.length === 0 ? "Sin barberos aún" : "Sin barberos en esta sede"}
            </p>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
              {barbers.length === 0 ? "Agrega el primer profesional de tu equipo." : "Asigna barberos a esta sede desde Sedes."}
            </p>
          </div>
          {barbers.length === 0 && (
            <button
              onClick={() => openModal()}
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginTop: 4 }}
            >
              <Plus size={14} /> Agregar barbero
            </button>
          )}
        </div>
      ) : (
        <div className="barber-grid">
          {displayedBarbers.map((barber, idx) => (
            <BarberCard
              key={barber.id}
              barber={barber}
              idx={idx}
              earnings={earningsMap[barber.id]}
              earningsLoading={earningsLoading}
              onEdit={() => openModal(barber)}
              onSchedule={() => openScheduleModal(barber)}
              onDeactivate={() => handleDeactivate(barber.id)}
              onActivate={() => handleActivate(barber.id)}
              onDelete={() => handleDelete(barber.id)}
            />
          ))}
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────── */}
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

      {/* ── Modal: confirmar desactivación ──────────────── */}
      {activeModal === "deactivate" && createPortal(
        <div style={BACKDROP}>
          <div style={{ ...MODAL_BOX, maxWidth: 380, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 8px" }}>¿Desactivar barbero?</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 20px" }}>El barbero perderá acceso y se cancelarán todas sus citas pendientes.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); setPendingDeactivateId(null); }}
                className="btn-ghost"
                style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeactivate}
                style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", transition: "background 150ms ease" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#b91c1c")}
                onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: confirmar eliminación permanente ───────── */}
      {activeModal === "delete" && createPortal(
        <div style={BACKDROP}>
          <div style={{ ...MODAL_BOX, maxWidth: 380, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 8px" }}>¿Eliminar barbero?</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 20px" }}>Esta acción es permanente y no se puede deshacer. Solo es posible si el barbero nunca ha tenido citas registradas.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setActiveModal(null); setPendingDeleteId(null); }}
                className="btn-ghost"
                style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", transition: "background 150ms ease" }}
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

      {/* ── Modal: credenciales ─────────────────────────── */}
      {newCredentials && createPortal(
        <div style={BACKDROP}>
          <div style={{ ...MODAL_BOX, maxWidth: 440, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
              }}>
                <UserCheck size={18} style={{ color: "var(--color-primary)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Barbero creado</h3>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                  Comparte estas credenciales con <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>{newCredentials.barber.name}</strong>.
                </p>
              </div>
            </div>

            <div style={{
              borderRadius: 12, padding: 16, marginBottom: 12,
              background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))",
              border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Credenciales de acceso</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tenantId && <CredentialRow label="Subdominio" value={tenantId} />}
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)", paddingTop: 12 }}>
                  <CredentialRow label="Correo" value={newCredentials.email} />
                </div>
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)", paddingTop: 12 }}>
                  <CredentialRow label="Contraseña temporal" value={newCredentials.password} mono />
                </div>
              </div>
            </div>

            <p style={{ fontSize: 11, padding: "8px 12px", borderRadius: 8, margin: "0 0 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
              Al ingresar por primera vez, se le pedirá cambiar esta contraseña.
            </p>

            <button
              onClick={() => { const b = newCredentials.barber; setNewCredentials(null); openScheduleModal(b, true); }}
              className="btn-primary"
              style={{ width: "100%", padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}
            >
              Continuar — Configurar horario
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: editar / crear barbero ───────────────── */}
      {activeModal === "edit" && createPortal(
        <div style={BACKDROP}>
          <div style={{ ...MODAL_BOX, maxWidth: 440, width: "100%", padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
              {editingId ? "Editar barbero" : "Nuevo barbero"}
            </h3>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 20px" }}>
              {editingId ? "Actualiza los datos del profesional." : "Completa los datos para crear el perfil."}
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {formError && (
                <div style={{
                  borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.5,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
                }}>
                  {formError}
                </div>
              )}
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>Foto del barbero</label>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <BarberAvatar name={name || "?"} size={56} imageBase64={imagePreview ?? currentImage} />
                  <div>
                    <label
                      className="btn-ghost"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      <ImagePlus size={13} /> Subir foto
                      <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleImageChange} />
                    </label>
                    <p style={{ color: "var(--color-text-muted)", fontSize: 11, marginTop: 6 }}>PNG, JPG o WebP. Máx. 2MB.</p>
                  </div>
                </div>
              </div>
              {[
                { label: "Nombre completo", value: name, setter: setName, type: "text", required: true, placeholder: "Carlos Ramírez" },
                { label: "Correo electrónico", value: email, setter: setEmail, type: "email", required: false, placeholder: "carlos@barberia.com" },
                { label: "Especialidad", value: specialty, setter: setSpecialty, type: "text", required: false, placeholder: "Corte clásico, Barba" },
              ].map(({ label, value, setter, type, required, placeholder }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 }}>{label}</label>
                  <input
                    type={type}
                    required={required}
                    value={value}
                    placeholder={placeholder}
                    onChange={e => setter(e.target.value)}
                    className="input-theme"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13 }}
                  />
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid var(--color-glass-border)", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn-ghost"
                  style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}>
                  {submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: horario ──────────────────────────────── */}
      {activeModal === "schedule" && scheduleBarber && createPortal(
        <div style={SCROLL_BACKDROP}>
          <div style={{ display: "flex", minHeight: "100%", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div style={{ ...MODAL_BOX, width: "100%", maxWidth: 520, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>
                Horario de{" "}
                <span style={{ color: "var(--color-primary)" }}>{scheduleBarber.name}</span>
              </h3>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
                Activa los días laborales y define la jornada de trabajo.
              </p>

              {scheduleIsNew && (
                <div style={{
                  fontSize: 11, padding: "8px 12px", borderRadius: 8, marginBottom: 16,
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b",
                }}>
                  <strong>Paso obligatorio:</strong> Sin horario configurado no se podrán agendar citas.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {DAY_NAMES.map((dayName, day) => {
                  const s = scheduleState[day];
                  return (
                    <div
                      key={day}
                      style={{
                        borderRadius: 12, padding: "10px 14px",
                        background: s.active
                          ? "color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))"
                          : "var(--color-bg)",
                        border: s.active
                          ? "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)"
                          : "1px solid var(--color-glass-border)",
                        transition: "background 200ms ease, border-color 200ms ease",
                      }}
                    >
                      {/* Fila principal: toggle + día + jornada */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <DayToggle active={s.active} onChange={v => updateDay(day, { active: v })} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", width: 90, flexShrink: 0 }}>{dayName}</span>
                        {s.active ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                            {[
                              { val: `${s.startHour}:${s.startMinute}`, setter: (v: string) => { const [h,m] = v.split(":").map(Number); updateDay(day, { startHour: h, startMinute: m }); } },
                              { val: `${s.endHour}:${s.endMinute}`,   setter: (v: string) => { const [h,m] = v.split(":").map(Number); updateDay(day, { endHour: h, endMinute: m }); } },
                            ].map(({ val, setter }, i) => (
                              <React.Fragment key={i}>
                                {i > 0 && <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>a</span>}
                                <select
                                  value={val}
                                  onChange={e => setter(e.target.value)}
                                  className="input-theme"
                                  style={{ flex: 1, padding: "4px 8px", borderRadius: 8, fontSize: 12 }}
                                >
                                  {TIME_OPTIONS.map(t => (
                                    <option key={t.label} value={`${t.hour}:${t.minute}`}>{t.label}</option>
                                  ))}
                                </select>
                              </React.Fragment>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "auto" }}>Día libre</span>
                        )}
                      </div>

                      {/* Fila de descanso — solo visible cuando el día está activo */}
                      {s.active && (
                        <div style={{
                          marginTop: 8, paddingTop: 8,
                          borderTop: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
                          display: "flex", alignItems: "center", gap: 10,
                        }}>
                          {/* Toggle descanso */}
                          <DayToggle active={s.breakEnabled} onChange={v => updateDay(day, { breakEnabled: v })} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", width: 90, flexShrink: 0 }}>Descanso</span>

                          {s.breakEnabled ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                              {[
                                { val: `${s.breakStartHour}:${s.breakStartMinute}`, setter: (v: string) => { const [h,m] = v.split(":").map(Number); updateDay(day, { breakStartHour: h, breakStartMinute: m }); } },
                                { val: `${s.breakEndHour}:${s.breakEndMinute}`,     setter: (v: string) => { const [h,m] = v.split(":").map(Number); updateDay(day, { breakEndHour: h, breakEndMinute: m }); } },
                              ].map(({ val, setter }, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>a</span>}
                                  <select
                                    value={val}
                                    onChange={e => setter(e.target.value)}
                                    className="input-theme"
                                    style={{ flex: 1, padding: "4px 8px", borderRadius: 8, fontSize: 12 }}
                                  >
                                    {TIME_OPTIONS.map(t => (
                                      <option key={t.label} value={`${t.hour}:${t.minute}`}>{t.label}</option>
                                    ))}
                                  </select>
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontStyle: "italic" }}>Sin descanso</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 16, marginTop: 8, borderTop: "1px solid var(--color-glass-border)" }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn-ghost"
                  style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleScheduleSave}
                  disabled={savingSchedule}
                  className="btn-primary"
                  style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}
                >
                  {savingSchedule ? "Guardando…" : "Guardar horario"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};