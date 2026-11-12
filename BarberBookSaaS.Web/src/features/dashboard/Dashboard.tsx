import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { appointmentService } from "../appointments/appointmentService";
import { barberService } from "../barbers/barberService";
import { reviewService } from "../reviews/reviewService";
import { customerService } from "../customers/customerService";
import { dashboardService } from "./dashboardService";
import { useLocations } from "../../hooks/useLocations";
import { LocationSelector } from "../locations/LocationSelector";
import type { DailyRevenue, DashboardStats, PeriodStats } from "./dashboardService";
import { WeeklyRevenueChart } from "./WeeklyRevenueChart";
import type { Appointment, AppointmentStatus } from "../appointments/appointmentTypes";
import type { Barber } from "../barbers/barberTypes";
import type { AdminReviewsResponse } from "../reviews/reviewService";
import { CalendarDays, Clock, Users, DollarSign, Star, Scissors, UserCheck, TrendingUp, UserPlus, Sparkles } from "lucide-react";
import { aiDiagnosisService, type AiDiagnosisQuota } from "../barbers/aiDiagnosisService";

/* ── Status pill ───────────────────────────────────────── */
const STATUS: Record<AppointmentStatus, { bg: string; text: string; dot: string; border: string }> = {
  Pendiente:  { bg: "rgba(245,158,11,0.1)",  text: "#f59e0b", dot: "#f59e0b", border: "rgba(245,158,11,0.28)" },
  Completada: { bg: "rgba(16,185,129,0.1)",  text: "#34d399", dot: "#10b981", border: "rgba(16,185,129,0.28)" },
  Cancelada:  { bg: "rgba(239,68,68,0.1)",   text: "#f87171", dot: "#ef4444", border: "rgba(239,68,68,0.26)" },
};

const StatusPill: React.FC<{ status: AppointmentStatus }> = ({ status }) => {
  const s = STATUS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        borderRadius: 99,
        fontSize: "12px",
        fontWeight: 600,
        background: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0, display: "block" }} />
      {status}
    </span>
  );
};

/* ── Stat card ─────────────────────────────────────────── */
type StatVariant = "primary" | "amber" | "violet" | "green" | "sky";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  variant?: StatVariant;
  delay?: number;
}

const VARIANTS: Record<StatVariant, {
  card: React.CSSProperties;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}> = {
  primary: {
    card: {
      background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
      border: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)",
    },
    label: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
    value: "var(--color-text)",
    iconBg: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
    iconColor: "var(--color-primary)",
  },
  amber: {
    card: {
      background: "rgba(245,158,11,0.09)",
      border: "1px solid rgba(245,158,11,0.22)",
      boxShadow: "0 0 28px rgba(245,158,11,0.06)",
    },
    label: "rgba(245,158,11,0.75)",
    value: "#f59e0b",
    iconBg: "rgba(245,158,11,0.2)",
    iconColor: "#f59e0b",
  },
  violet: {
    card: {
      background: "color-mix(in srgb, var(--color-secondary) 8%, transparent)",
      border: "1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent)",
    },
    label: "color-mix(in srgb, var(--color-secondary) 70%, transparent)",
    value: "var(--color-text)",
    iconBg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
    iconColor: "color-mix(in srgb, var(--color-secondary) 80%, white)",
  },
  green: {
    card: {
      background: "rgba(16,185,129,0.08)",
      border: "1px solid rgba(16,185,129,0.18)",
      boxShadow: "0 0 28px rgba(16,185,129,0.05)",
    },
    label: "rgba(16,185,129,0.75)",
    value: "var(--color-text)",
    iconBg: "rgba(16,185,129,0.2)",
    iconColor: "#34d399",
  },
  sky: {
    card: {
      background: "rgba(56,189,248,0.08)",
      border: "1px solid rgba(56,189,248,0.18)",
      boxShadow: "0 0 28px rgba(56,189,248,0.05)",
    },
    label: "rgba(56,189,248,0.75)",
    value: "var(--color-text)",
    iconBg: "rgba(56,189,248,0.2)",
    iconColor: "#38bdf8",
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, variant = "primary", delay = 0 }) => {
  const v = VARIANTS[variant];
  return (
    <div
      className="fade-up stat-card-compact"
      style={{ ...v.card, borderRadius: "20px", padding: "28px", display: "flex", flexDirection: "column", gap: "18px", animationDelay: `${delay}ms` }}
    >
      <div
        className="stat-icon rounded-xl flex items-center justify-center shrink-0"
        style={{ width: 50, height: 50, background: v.iconBg, color: v.iconColor }}
      >
        {icon}
      </div>
      <div>
        <p
          className="stat-label"
          style={{
            color: v.label,
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </p>
        <p
          className="stat-number"
          style={{
            color: v.value,
            fontSize: "44px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </p>
        {sub && (
          <p className="stat-sub" style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500, marginTop: "10px" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
};

/* ── Star rating ───────────────────────────────────────── */
const StarRating: React.FC<{ value: number; max?: number; size?: number }> = ({ value, max = 5, size = 13 }) => (
  <span style={{ display: "inline-flex", gap: "2px" }}>
    {Array.from({ length: max }, (_, i) => (
      <Star
        key={i}
        size={size}
        className={i < Math.round(value) ? "fill-amber-400 text-amber-400" : ""}
        style={i >= Math.round(value) ? { color: "var(--color-border)", fill: "var(--color-border)" } : {}}
      />
    ))}
  </span>
);

/* ── Section card ──────────────────────────────────────── */
const SectionCard: React.FC<{
  title: string;
  count?: number;
  children: React.ReactNode;
  right?: React.ReactNode;
  delay?: number;
}> = ({ title, count, children, right, delay = 0 }) => (
  <div
    className="overflow-hidden fade-up"
    style={{
      borderRadius: "20px",
      background: "var(--color-glass-surface)",
      border: "1px solid var(--color-glass-border)",
      animationDelay: `${delay}ms`,
    }}
  >
    <div
      style={{
        padding: "22px 28px",
        borderBottom: "1px solid var(--color-glass-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: 3,
            height: 20,
            borderRadius: 99,
            background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
            flexShrink: 0,
          }}
        />
        <h2
          style={{
            color: "var(--color-text)",
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
          {count !== undefined && (
            <span style={{ color: "var(--color-text-muted)", fontWeight: 400, fontSize: "14px", marginLeft: "8px" }}>
              ({count})
            </span>
          )}
        </h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);

/* ── Avatar ────────────────────────────────────────────── */
const AVATAR_PALETTE = [
  { bg: "color-mix(in srgb, var(--color-primary) 18%, transparent)", text: "var(--color-primary)" },
  { bg: "rgba(139,92,246,0.18)", text: "#a78bfa" },
  { bg: "rgba(16,185,129,0.18)", text: "#34d399" },
  { bg: "rgba(245,158,11,0.18)", text: "#f59e0b" },
];

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 36 }) => {
  const c = AVATAR_PALETTE[name.charCodeAt(0) % 4];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.36,
        background: c.bg,
        color: c.text,
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

/* ── Skeleton ──────────────────────────────────────────── */
const StatSkeleton: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
  <div
    className="skeleton-shimmer fade-up"
    style={{ borderRadius: "20px", height: 172, animationDelay: `${delay}ms` }}
  />
);

/* ── Empty placeholder ─────────────────────────────────── */
const EmptyRow: React.FC<{ icon: React.ReactNode; text: string; sub?: string }> = ({ icon, text, sub }) => (
  <div style={{ padding: "56px 28px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-glass-surface)",
        color: "var(--color-text-muted)",
        marginBottom: "12px",
      }}
    >
      {icon}
    </div>
    <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500 }}>{text}</p>
    {sub && (
      <p style={{ color: "var(--color-text-muted)", fontSize: "11px", marginTop: "4px", opacity: 0.6, maxWidth: 300 }}>{sub}</p>
    )}
  </div>
);

/* ── Row item ──────────────────────────────────────────── */
const AppointmentRow: React.FC<{
  appointment: Appointment;
  last?: boolean;
  showDate?: boolean;
}> = ({ appointment: a, last, showDate }) => {
  const fmt  = (iso: string) => iso.split("T")[1]?.substring(0, 5) ?? "";
  const fmtD = (iso: string) => {
    const [y, m, d] = iso.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div
      className="dashboard-appt-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "18px 28px",
        borderBottom: !last ? "1px solid var(--color-glass-border)" : undefined,
        transition: "background 160ms ease",
        cursor: "default",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 4%, transparent)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <Avatar name={a.customerName} size={44} />
      <div className="dashboard-appt-info" style={{ minWidth: 0, flex: 1 }}>
        <p className="dashboard-appt-name" style={{ color: "var(--color-text)", fontSize: "15px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "8px" }}>
          {a.customerName}
          {a.isWalkIn && (
            <span style={{
              fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px",
              background: "rgba(168,85,247,0.12)", color: "#a855f7",
              border: "1px solid rgba(168,85,247,0.25)", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              Sin cita
            </span>
          )}
        </p>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
          {a.barber?.name ?? "—"} &middot; {a.service?.name ?? "—"}
        </p>
      </div>
      <div className="dashboard-appt-meta" style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        {showDate ? (
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "var(--color-text)", fontSize: "14px", fontWeight: 600 }}>{fmtD(a.appointmentDate)}</p>
            <p style={{ color: "var(--color-text-muted)", fontSize: "12px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace", marginTop: "2px" }}>{fmt(a.appointmentDate)}</p>
          </div>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: "13px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace", fontWeight: 500 }}>
            {fmt(a.appointmentDate)}
          </span>
        )}
        {!showDate && <StatusPill status={a.status} />}
      </div>
    </div>
  );
};

/* ── Main component ────────────────────────────────────── */
export const Dashboard: React.FC = () => {
  const { locations, hasMultipleLocations } = useLocations();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [todayAppts, setTodayAppts]       = useState<Appointment[]>([]);
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([]);
  const [barbers, setBarbers]             = useState<Barber[]>([]);
  const [reviewsData, setReviewsData]     = useState<AdminReviewsResponse | null>(null);
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null);
  const [weeklyRevenue, setWeeklyRevenue] = useState<DailyRevenue[] | null>(null);
  const [weeklyRevenueError, setWeeklyRevenueError] = useState(false);
  const [weeklyRevenueLoading, setWeeklyRevenueLoading] = useState(true);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading]             = useState(true);
  type TimeRange = 'today' | 7 | 15 | 30;
  const [timeRange, setTimeRange]       = useState<TimeRange>('today');
  const [periodStats, setPeriodStats]   = useState<PeriodStats | null>(null);
  const [aiQuota, setAiQuota]             = useState<AiDiagnosisQuota | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    aiDiagnosisService.getQuota().then(q => { if (q && q.plan !== "Standard") setAiQuota(q); }).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      appointmentService.getToday().catch(() => []),
      appointmentService.getWeek().catch(() => []),
      barberService.getAll().catch(() => []),
      reviewService.getAdminReviews(5).catch(() => null),
      customerService.getAll(1, 1).catch(() => null),
    ]).then(([today, week, barbs, reviews, customers]) => {
      setTodayAppts(today as Appointment[]);
      const todayDate = new Date().toISOString().split("T")[0];
      setUpcomingAppts((week as Appointment[]).filter(a => a.appointmentDate.split("T")[0] > todayDate && a.status === "Pendiente").slice(0, 6));
      setBarbers(barbs as Barber[]);
      setReviewsData(reviews as AdminReviewsResponse | null);
      if (customers) setTotalCustomers((customers as { total: number }).total);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setWeeklyRevenueLoading(true);
    setWeeklyRevenueError(false);
    setPeriodStats(null);

    if (timeRange === 'today') {
      dashboardService.getWeeklyRevenue(selectedLocationId, 7)
        .then(revenue => setWeeklyRevenue(revenue))
        .catch(() => setWeeklyRevenueError(true))
        .finally(() => setWeeklyRevenueLoading(false));

      dashboardService.getStats(selectedLocationId)
        .then(stats => setDashStats(stats))
        .catch(() => {});
    } else {
      Promise.all([
        dashboardService.getWeeklyRevenue(selectedLocationId, timeRange),
        dashboardService.getPeriodStats(timeRange, selectedLocationId),
      ])
        .then(([revenue, period]) => {
          setWeeklyRevenue(revenue);
          setPeriodStats(period);
        })
        .catch(() => setWeeklyRevenueError(true))
        .finally(() => setWeeklyRevenueLoading(false));
    }
  }, [selectedLocationId, timeRange]);

  const locationFilter = <T extends { locationId?: string | null }>(items: T[]): T[] =>
    hasMultipleLocations && selectedLocationId ? items.filter(i => i.locationId === selectedLocationId) : items;

  const todayAll      = locationFilter(todayAppts);
  const todayPending  = todayAll.filter(a => a.status === "Pendiente");
  const todayComplete = todayAll.filter(a => a.status === "Completada");
  const revenueToday  = todayComplete.reduce((s, a) => s + (a.service?.price ?? 0), 0);
  const revenuePend   = todayPending.reduce((s, a) => s + (a.service?.price ?? 0), 0);
  const upcoming      = locationFilter(upcomingAppts);
  const displayedBarbers = locationFilter(barbers);

  const dayLabel = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="dashboard-mobile-compact" style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div
              style={{
                width: 4,
                height: 32,
                borderRadius: 99,
                background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
                flexShrink: 0,
              }}
            />
            <h1
              style={{
                color: "var(--color-text)",
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Resumen del negocio
            </h1>
          </div>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginLeft: "16px",
            }}
          >
            {dayLabel}
          </p>
        </div>

        {/* Selector de rango */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "var(--color-glass-surface)",
            borderRadius: 10,
            padding: 4,
            border: "1px solid var(--color-glass-border)",
            flexShrink: 0,
          }}
        >
          {([ ['Hoy', 'today'], ['7 días', 7], ['15 días', 15], ['30 días', 30] ] as [string, TimeRange][]).map(([label, value]) => (
            <button
              key={label}
              onClick={() => setTimeRange(value)}
              style={{
                padding: "6px 14px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                transition: "all 150ms ease",
                background: timeRange === value
                  ? "var(--color-primary)"
                  : "transparent",
                color: timeRange === value
                  ? "var(--color-bg)"
                  : "var(--color-text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {aiQuota && (
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 10,
            background: aiQuota.remaining === 0
              ? "rgba(239,68,68,0.08)"
              : "rgba(167,139,250,0.08)",
            border: `1px solid ${aiQuota.remaining === 0 ? "rgba(239,68,68,0.22)" : "rgba(167,139,250,0.22)"}`,
          }}>
            <Sparkles size={13} style={{ color: aiQuota.remaining === 0 ? "#f87171" : "#a78bfa", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
              Diagnósticos IA:{" "}
              <span style={{ color: aiQuota.remaining === 0 ? "#f87171" : "var(--color-text)", fontWeight: 700 }}>
                {aiQuota.limit === -1
                  ? "Ilimitados"
                  : `${aiQuota.used}/${aiQuota.limit} este mes`
                }
              </span>
              {aiQuota.limit !== -1 && aiQuota.remaining > 0 && (
                <span style={{ color: "#a78bfa", marginLeft: 4 }}>
                  · {aiQuota.remaining} disponibles
                </span>
              )}
              {aiQuota.remaining === 0 && aiQuota.resetDate && (
                <span style={{ color: "#f87171", marginLeft: 4 }}>
                  · Reinicia {new Date(aiQuota.resetDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {hasMultipleLocations && (
        <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end" }}>
          <LocationSelector
            locations={locations}
            selectedLocationId={selectedLocationId}
            onChange={setSelectedLocationId}
          />
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────── */}
      {loading && timeRange === 'today' ? (
        <div className="stat-grid">
          {[0, 70, 140, 210, 280].map(d => <StatSkeleton key={d} delay={d} />)}
        </div>
      ) : weeklyRevenueLoading && timeRange !== 'today' ? (
        <div className="stat-grid">
          {[0, 70, 140, 210].map(d => <StatSkeleton key={d} delay={d} />)}
        </div>
      ) : timeRange === 'today' ? (
        <>
          {/* ── MODO HOY: grilla original ─────────────────── */}
          <div className="stat-grid">
            <StatCard
              label="Citas de hoy"
              value={todayAll.length}
              icon={<CalendarDays size={22} />}
              sub={`${todayComplete.length} complet. · ${todayPending.length} pend.`}
              variant="primary"
              delay={0}
            />
            <StatCard
              label="Pendientes"
              value={todayPending.length}
              icon={<Clock size={22} />}
              sub="Por atender hoy"
              variant="amber"
              delay={70}
            />
            <StatCard
              label="Barberos activos"
              value={displayedBarbers.length}
              icon={<Users size={22} />}
              sub={displayedBarbers.length === 1 ? "profesional" : "profesionales"}
              variant="violet"
              delay={140}
            />
            <StatCard
              label="Ingresos hoy"
              value={`$${revenueToday.toLocaleString("es-CO")}`}
              icon={<DollarSign size={22} />}
              sub={revenuePend > 0 ? `+ $${revenuePend.toLocaleString("es-CO")} potencial` : "confirmados"}
              variant="green"
              delay={210}
            />
            <StatCard
              label="Clientes registrados"
              value={totalCustomers ?? "—"}
              icon={<UserCheck size={22} />}
              sub="en tu barbería"
              variant="sky"
              delay={280}
            />
            {/* Tarjeta walk-in (diseño especial) */}
            <div
              className="fade-up stat-card-compact walkin-card"
              style={{
                borderRadius: "20px",
                background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.18)",
                boxShadow: "0 0 28px rgba(168,85,247,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                padding: "28px",
                overflow: "hidden",
                animationDelay: "350ms",
              }}
            >
              <div
                className="stat-icon rounded-xl flex items-center justify-center shrink-0"
                style={{ width: 50, height: 50, background: "rgba(168,85,247,0.18)", color: "#a855f7" }}
              >
                <UserPlus size={22} />
              </div>
              <div>
                <p
                  className="stat-label"
                  style={{
                    color: "rgba(168,85,247,0.75)",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "10px",
                  }}
                >
                  Clientes sin cita
                </p>
                <div className="walkin-card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div className="walkin-card-half" style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <p className="stat-number" style={{ color: "var(--color-text)", fontSize: "44px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {dashStats?.todayWalkIns ?? 0}
                    </p>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500 }}>hoy</p>
                  </div>
                  <div className="walkin-card-divider" style={{ height: 1, background: "rgba(168,85,247,0.18)" }} />
                  <div className="walkin-card-half" style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <p style={{ color: "var(--color-text)", fontSize: "22px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {dashStats?.totalWalkIns ?? 0}
                    </p>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "13px", fontWeight: 500 }}>total</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── MODO PERÍODO: 4 tarjetas de totales ──────── */}
          <div className="stat-grid">
            <StatCard
              label="Citas del período"
              value={periodStats?.totalAppointments ?? 0}
              icon={<CalendarDays size={22} />}
              sub="no canceladas"
              variant="primary"
              delay={0}
            />
            <StatCard
              label="Ingresos totales"
              value={`$${(periodStats?.totalRevenue ?? 0).toLocaleString("es-CO")}`}
              icon={<DollarSign size={22} />}
              sub="citas completadas"
              variant="green"
              delay={70}
            />
            <StatCard
              label="Clientes nuevos"
              value={periodStats?.newCustomers ?? 0}
              icon={<UserCheck size={22} />}
              sub="registrados en el período"
              variant="sky"
              delay={140}
            />
            <StatCard
              label="Clientes sin cita"
              value={periodStats?.totalWalkIns ?? 0}
              icon={<UserPlus size={22} />}
              sub="walk-ins en el período"
              variant="violet"
              delay={210}
            />
          </div>
        </>
      )}

          {/* ── Weekly revenue chart ────────────────────────── */}
          {weeklyRevenueLoading ? (
            <div
              className="skeleton-shimmer fade-up"
              style={{ borderRadius: 20, height: 340, animationDelay: "300ms" }}
            />
          ) : weeklyRevenueError ? (
            <div
              className="fade-up"
              style={{
                borderRadius: 20,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                padding: "40px 28px",
                textAlign: "center",
                animationDelay: "300ms",
              }}
            >
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, fontWeight: 500 }}>
                No se pudo cargar la gráfica
              </p>
            </div>
          ) : weeklyRevenue ? (
            <div
              className="fade-up"
              style={{
                borderRadius: 20,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                padding: "24px 20px 16px",
                animationDelay: "300ms",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingLeft: 8 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "color-mix(in srgb, var(--color-primary) 16%, transparent)",
                    color: "var(--color-primary)",
                    flexShrink: 0,
                  }}
                >
                  <TrendingUp size={18} />
                </div>
                <h2
                  style={{
                    color: "var(--color-text)",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {timeRange === 'today'
                    ? "Ingresos de los últimos 7 días"
                    : `Ingresos de los últimos ${timeRange} días`}
                </h2>
              </div>
              <WeeklyRevenueChart data={weeklyRevenue} />
            </div>
          ) : null}

      {timeRange === 'today' && (
        <>
          {/* ── Today's appointments ─────────────────────────── */}
          <SectionCard title="Citas de hoy" count={todayAll.length} delay={280} right={
            <button onClick={() => navigate("/appointments")} style={{
              fontSize: 12, fontWeight: 600, color: "var(--color-primary)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "opacity 150ms",
            }} onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")} onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              Ver todas →
            </button>
          }>
            {todayAll.length === 0 ? (
              <EmptyRow
                icon={<CalendarDays size={18} />}
                text="Sin citas para hoy"
              />
            ) : (
              <div>
                {todayAll.map((a, idx) => (
                  <AppointmentRow key={a.id} appointment={a} last={idx === todayAll.length - 1} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── Upcoming ─────────────────────────────────────── */}
          {upcoming.length > 0 && (
            <SectionCard title="Próximas citas" count={upcoming.length} delay={340}>
              <div>
                {upcoming.map((a, idx) => (
                  <AppointmentRow key={a.id} appointment={a} last={idx === upcoming.length - 1} showDate />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

          {/* ── Reviews ──────────────────────────────────────── */}
          <SectionCard
            title="Reseñas"
            count={reviewsData?.totalReviews}
            delay={upcoming.length > 0 ? 400 : 340}
            right={
              reviewsData && reviewsData.totalReviews > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <StarRating value={reviewsData.averageRating} />
                  <span style={{ color: "var(--color-text)", fontSize: "13px", fontWeight: 700 }}>
                    {reviewsData.averageRating.toFixed(1)}
                  </span>
                </div>
              ) : undefined
            }
          >
            {!reviewsData || reviewsData.totalReviews === 0 ? (
              <EmptyRow
                icon={<Star size={18} />}
                text="Aún no hay reseñas"
                sub="Comparte el QR con tus clientes desde Mi Barbería"
              />
            ) : (
              <div>
                {reviewsData.reviews.map((r, idx) => (
                  <div
                    key={r.id}
                    style={{
                      padding: "18px 28px",
                      borderBottom: idx < reviewsData.reviews.length - 1 ? "1px solid var(--color-glass-border)" : undefined,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <StarRating value={r.rating} size={15} />
                      {r.comment && (
                        <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginTop: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.comment}
                        </p>
                      )}
                    </div>
                    <span style={{ color: "var(--color-text-muted)", fontSize: "12px", flexShrink: 0, marginTop: "2px" }}>
                      {new Date(r.createdAt).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

      {timeRange === 'today' && todayAppts.length === 0 && barbers.length === 0 && (
        <div
          className="fade-up"
          style={{
            borderRadius: "20px",
            padding: "64px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            border: "1px dashed var(--color-glass-border)",
            background: "var(--color-glass-surface)",
            animationDelay: "400ms",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
              color: "var(--color-primary)",
              marginBottom: "16px",
            }}
          >
            <Scissors size={20} />
          </div>
          <p
            style={{
              color: "var(--color-text)",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: "8px",
            }}
          >
            Tu barbería está lista.
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "12px", maxWidth: 320 }}>
            Agrega barberos, configura sus horarios y comienza a agendar citas.
          </p>
        </div>
      )}
    </div>
  );
};