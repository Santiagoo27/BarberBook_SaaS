import { useState, useEffect, useRef } from "react";
import type { ReactNode, MouseEvent, CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  Menu,
  X,
  Check,
  Phone,
  Mail,
  CalendarCheck,
  LayoutDashboard,
  MessageCircle,
  Award,
  QrCode,
  Palette,
} from "lucide-react";
import { BackgroundGradientAnimation } from "../../components/BackgroundGradientAnimation";

/* ── Identidad visual ──────────────────────────────────── */
const BRAND = "#9CA3AF";
const ACCENT = "#CBD2D9";
const BG = "#0a0a0a";
const SURFACE = "#111111";
const BORDER = "#1e1e1e";
const TEXT = "#f5f5f5";
const TEXT_MUTED = "#8a8a8a";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const NAV_HEIGHT = 72;

function withAlpha(hex: string, alpha: number) {
  return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/* ── Estilos compartidos ────────────────────────────────── */
const sectionTitle: CSSProperties = {
  fontSize: "clamp(1.875rem, 4vw, 2.75rem)",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.15,
  textWrap: "balance",
  color: TEXT,
};

const sectionLead: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.7,
  color: TEXT_MUTED,
  maxWidth: "58ch",
};

/* ── Contenido ──────────────────────────────────────────── */
const NAV_LINKS = [
  { id: "que-es", label: "Qué es" },
  { id: "caracteristicas", label: "Características" },
  { id: "contacto", label: "Contacto" },
];

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: CalendarCheck,
    title: "Agendamiento en tiempo real",
    description:
      "La disponibilidad se actualiza al instante: dos clientes nunca pueden reservar el mismo horario con el mismo barbero.",
  },
  {
    icon: LayoutDashboard,
    title: "Panel de administración completo",
    description:
      "Gestiona barberos, servicios, citas y clientes desde un panel pensado para el día a día de una barbería.",
  },
  {
    icon: MessageCircle,
    title: "Recordatorios por WhatsApp",
    description:
      "Tus clientes reciben un mensaje automático antes de su cita, sin que nadie tenga que escribirles a mano.",
  },
  {
    icon: Award,
    title: "Sistema de fidelización de puntos",
    description:
      "Cada visita suma puntos. Al llegar al umbral que definas, el cliente recibe un corte gratis.",
  },
  {
    icon: QrCode,
    title: "Reseñas con código QR",
    description:
      "Imprime el QR de tu barbería y deja que tus clientes califiquen el servicio apenas terminan su cita.",
  },
  {
    icon: Palette,
    title: "Personalización de marca completa",
    description:
      "Cambia colores, tema y logo para que la página de reservas se vea como tu barbería, no como una plantilla.",
  },
];

interface Plan {
  name: string;
  price: string;
  highlighted: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: "Plan Estándar",
    price: "$65.000",
    highlighted: false,
    features: [
      "Panel de administración",
      "Gestión de barberos y horarios",
      "Gestión de servicios",
      "Agenda y citas",
      "Base de clientes",
      "Reseñas con QR",
      "Booking público con carrusel de fotos",
      "Recordatorios por WhatsApp",
    ],
  },
  {
    name: "Plan Premium",
    price: "$100.000",
    highlighted: true,
    features: [
      "Todo lo del Plan Estándar",
      "100 diagnósticos de cortes con IA al mes",
      "Soporte prioritario",
    ],
  },
  {
    name: "Plan Premium Ilimitado",
    price: "$200.000",
    highlighted: false,
    features: [
      "Todo lo del Plan Premium",
      "Diagnósticos de cortes con IA ilimitados",
      "Soporte prioritario",
    ],
  },
];

interface TeamMember {
  name: string;
  role: string;
  phone: string;
  phoneHref: string;
  email: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Santiago Felipe Obando Rosero",
    role: "Co-fundador y desarrollador",
    phone: "+57 310 546 1458",
    phoneHref: "+573105461458",
    email: "obandosantiago2704@gmail.com",
  },
  {
    name: "Juan Pablo Lopez Rodriguez",
    role: "Co-fundador y desarrollador",
    phone: "+57 305 469 6666",
    phoneHref: "+573054696666",
    email: "lopezpablorodriguez.117@gmail.com",
  },
];

/* ── Reveal: fade-in al entrar en viewport ─────────────── */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ── Botón CTA (link interno o ancla con scroll) ───────── */
function CtaButton({
  to,
  href,
  onClick,
  variant,
  size = "md",
  fullWidth = false,
  children,
}: {
  to?: string;
  href?: string;
  onClick?: (e: MouseEvent) => void;
  variant: "primary" | "outline";
  size?: "sm" | "md";
  fullWidth?: boolean;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    padding: size === "sm" ? "9px 18px" : "14px 28px",
    borderRadius: 10,
    fontSize: size === "sm" ? 13 : 15,
    fontWeight: 700,
    textDecoration: "none",
    cursor: "pointer",
    boxSizing: "border-box",
    transition:
      "transform 160ms cubic-bezier(0.16,1,0.3,1), background-color 200ms ease, color 200ms ease, box-shadow 200ms ease",
    transform: pressed ? "scale(0.97)" : hover ? "translateY(-2px)" : "translateY(0) scale(1)",
    ...(variant === "primary"
      ? {
          background: BRAND,
          color: "#0a0a0a",
          border: "1px solid transparent",
          boxShadow: hover ? `0 10px 28px ${withAlpha(BRAND, 0.32)}` : "0 0 0 transparent",
        }
      : {
          background: hover ? BRAND : "transparent",
          color: hover ? "#0a0a0a" : BRAND,
          border: `1px solid ${BRAND}`,
        }),
  };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPressed(false);
    },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
  };

  if (to) {
    return (
      <Link to={to} style={style} {...handlers}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} onClick={onClick} style={style} {...handlers}>
      {children}
    </a>
  );
}

/* ── Tarjeta de característica (dark style) ────────────── */
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        padding: 26,
        borderRadius: 18,
        background: "#101010",
        border: `1px solid ${BORDER}`,
        height: "100%",
        boxSizing: "border-box",
        transition: "border-color 0.3s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = withAlpha(BRAND, 0.4))}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: withAlpha(BRAND, 0.12),
          marginBottom: 18,
        }}
      >
        <Icon size={20} color={BRAND} strokeWidth={2} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 9px", color: TEXT }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.5, color: TEXT_MUTED, margin: 0 }}>{description}</p>
    </motion.div>
  );
}

/* ── Resplandor ambiental decorativo de fondo ──────────── */
function AmbientGlow({ style }: { style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        pointerEvents: "none",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(156,163,175,0.08), transparent 70%)",
        filter: "blur(70px)",
        ...style,
      }}
    />
  );
}

/* ── Tarjeta de plan ────────────────────────────────────── */
function PlanCard({ plan }: { plan: Plan }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "36px 32px",
        borderRadius: 18,
        boxSizing: "border-box",
        background: plan.highlighted
          ? `linear-gradient(160deg, ${withAlpha(BRAND, 0.1)}, ${withAlpha(BRAND, 0.02)} 60%)`
          : SURFACE,
        border: `1px solid ${plan.highlighted ? withAlpha(BRAND, 0.5) : BORDER}`,
      }}
    >
      {plan.highlighted && (
        <span
          style={{
            position: "absolute",
            top: -13,
            left: 32,
            background: BRAND,
            color: "#0a0a0a",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          Más popular
        </span>
      )}

      <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", margin: "0 0 8px", color: TEXT }}>
        {plan.name}
      </h3>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 28 }}>
        <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>{plan.price}</span>
        <span style={{ fontSize: 14, color: TEXT_MUTED }}>COP/mes</span>
      </div>

      <ul style={{ listStyle: "none", margin: "0 0 32px", padding: 0, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {plan.features.map((feature) => (
          <li key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.5, color: TEXT }}>
            <Check size={16} style={{ color: BRAND, flexShrink: 0, marginTop: 2 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton href="https://wa.me/573105461458?text=Hola%2C%20me%20interesa%20el%20plan" variant={plan.highlighted ? "primary" : "outline"} fullWidth>
        Comenzar ahora
      </CtaButton>
    </motion.div>
  );
}

/* ── Link de contacto (teléfono / correo) ──────────────── */
function ContactLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
        fontWeight: 500,
        color: hover ? BRAND : TEXT,
        textDecoration: "none",
        transition: "color 150ms ease",
      }}
    >
      <Icon size={15} style={{ color: BRAND, flexShrink: 0 }} />
      {children}
    </a>
  );
}

/* ── Tarjeta de contacto del equipo ─────────────────────── */
function ContactCard({ member }: { member: TeamMember }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "32px 28px",
        borderRadius: 16,
        background: BG,
        border: `1px solid ${hover ? withAlpha(BRAND, 0.35) : BORDER}`,
        transition: "border-color 200ms ease",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: withAlpha(BRAND, 0.12),
          color: BRAND,
          fontSize: 17,
          fontWeight: 800,
          marginBottom: 20,
        }}
      >
        {initials(member.name)}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: TEXT }}>{member.name}</h3>
      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "0 0 20px" }}>{member.role}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ContactLink href={`https://wa.me/${member.phoneHref}`} icon={Phone}>
          {member.phone}
        </ContactLink>
        <ContactLink href={`mailto:${member.email}`} icon={Mail}>
          {member.email}
        </ContactLink>
      </div>
    </motion.div>
  );
}

/* ── Mockup: teléfono con booking ──────────────────────── */
function BookingPhoneMockup() {
  const steps = ["Servicio", "Barbero", "Fecha", "Confirmar"];
  const activeStep = 2;
  const days = [
    { d: "25", day: "Mié", active: false },
    { d: "26", day: "Jue", active: false },
    { d: "27", day: "Vie", active: true },
    { d: "28", day: "Sáb", active: false },
    { d: "29", day: "Dom", active: false },
  ];
  const slots = [
    { time: "09:00", available: true },
    { time: "09:30", available: false },
    { time: "10:00", available: true },
    { time: "10:30", available: true },
    { time: "11:00", available: false },
    { time: "11:30", available: true, selected: true },
    { time: "14:00", available: true },
    { time: "14:30", available: true },
  ];
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ position: "relative", width: 280, height: 560, borderRadius: 42, background: "#0d0d0d", border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,.6)", padding: 14 }}
    >
      <div style={{ position: "absolute", left: "50%", top: 14, transform: "translateX(-50%)", width: 90, height: 7, borderRadius: 4, background: BORDER, zIndex: 3 }} />
      <div style={{ height: "100%", borderRadius: 30, background: "linear-gradient(180deg,#111,#0c0c0c)", overflow: "hidden", padding: "34px 14px 14px" }}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 16 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700,
                background: i < activeStep ? BRAND : i === activeStep ? BRAND : "#222",
                color: i <= activeStep ? "#0a0a0a" : TEXT_MUTED,
              }}>{i + 1}</div>
              {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: i < activeStep ? BRAND : "#333" }} />}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em" }}>Elige fecha y hora</div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>Corte clásico · con Carlos</div>
        {/* Day selector */}
        <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
          {days.map(d => (
            <div key={d.d} style={{
              flex: 1, padding: "8px 0", borderRadius: 10, textAlign: "center",
              background: d.active ? BRAND : "#161616",
              border: `1px solid ${d.active ? BRAND : BORDER}`,
            }}>
              <div style={{ fontSize: 8, color: d.active ? "#0a0a0a" : TEXT_MUTED, fontWeight: 600 }}>{d.day}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: d.active ? "#0a0a0a" : TEXT, marginTop: 2 }}>{d.d}</div>
            </div>
          ))}
        </div>
        {/* Time slots */}
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontWeight: 600, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Horarios disponibles</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {slots.map(s => (
            <div key={s.time} style={{
              padding: "9px 0", borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 600,
              background: s.selected ? BRAND : s.available ? "#161616" : "#111",
              border: `1px solid ${s.selected ? BRAND : s.available ? BORDER : "#181818"}`,
              color: s.selected ? "#0a0a0a" : s.available ? TEXT : "#333",
            }}>{s.time}</div>
          ))}
        </div>
        <div style={{ marginTop: 14, textAlign: "center", padding: 11, borderRadius: 10, background: BRAND, color: "#0a0a0a", fontWeight: 700, fontSize: 13 }}>Continuar →</div>
      </div>
    </motion.div>
  );
}

/* ── Mockup: dashboard de administración ───────────────── */
function DashboardMockup() {
  const stats = [
    { label: "CITAS DE HOY", value: "12", sub: "8 complet. · 4 pend.", bg: "#0d1117", border: "#1e2a35", color: TEXT },
    { label: "PENDIENTES", value: "4", sub: "Por atender hoy", bg: "#1a1500", border: "#3d3200", color: "#f59e0b" },
    { label: "BARBEROS ACTIVOS", value: "3", sub: "profesionales", bg: "#0d1912", border: "#1a3325", color: "#10b981" },
    { label: "INGRESOS HOY", value: "$285.000", sub: "confirmados", bg: "#0d1912", border: "#1a3325", color: "#10b981" },
    { label: "CLIENTES", value: "48", sub: "en tu barbería", bg: "#0d1520", border: "#1a2a3d", color: "#38bdf8" },
  ];
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ width: "100%", maxWidth: 540, borderRadius: 20, background: "#0a0a0a", border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,.55)", overflow: "hidden" }}
    >
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {stats.map(s => (
            <div key={s.label} style={{ flex: "1 0 90px", padding: "14px 12px", borderRadius: 14, background: s.bg, border: `1px solid ${s.border}` }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 6, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: "14px 14px 10px", borderRadius: 14, background: "#111", border: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>Ingresos de los últimos 7 días</div>
          </div>
          <div style={{ position: "relative", height: 90 }}>
            {/* Y axis labels */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              {["$94k", "$75k", "$50k", "$25k", "$0"].map(v => (
                <span key={v} style={{ fontSize: 7, color: TEXT_MUTED, lineHeight: 1 }}>{v}</span>
              ))}
            </div>
            {/* Chart */}
            <div style={{ marginLeft: 28, height: 74 }}>
              <svg viewBox="0 0 300 70" fill="none" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,68 C25,66 40,58 75,52 C110,46 120,30 150,28 C180,26 195,45 225,48 C255,51 265,20 280,15 C290,12 300,8 300,8" stroke={BRAND} strokeWidth="2" fill="none" />
                <path d="M0,68 C25,66 40,58 75,52 C110,46 120,30 150,28 C180,26 195,45 225,48 C255,51 265,20 280,15 C290,12 300,8 300,8 L300,70 L0,70 Z" fill="url(#lineGrad)" />
                {[[0,68],[75,52],[150,28],[225,48],[280,15]].map(([cx,cy],i) => (
                  <circle key={i} cx={cx} cy={cy} r="3" fill={BRAND} stroke="#111" strokeWidth="1.5" />
                ))}
              </svg>
            </div>
            {/* X axis labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginLeft: 28, marginTop: 2 }}>
              {days.map(d => (
                <span key={d} style={{ fontSize: 7, color: TEXT_MUTED }}>{d}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Mockup: teléfono panel del barbero ────────────────── */
function BarberPhoneMockup() {
  const stats = [
    { label: "TOTAL HOY", value: "6", color: BRAND },
    { label: "PENDIENTES", value: "3", color: "#f59e0b" },
    { label: "COMPLETADAS", value: "2", color: "#10b981" },
    { label: "CANCELADAS", value: "1", color: "#ef4444" },
  ];
  const appointments = [
    { time: "10:00", name: "Carlos M.", service: "Fade + Barba", status: "Pendiente" },
    { time: "11:30", name: "Diego P.", service: "Corte clásico", status: "Completada" },
    { time: "14:00", name: "Steven G.", service: "Diseño + cejas", status: "Pendiente" },
  ];
  const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
    Pendiente: { bg: "rgba(245,158,11,0.10)", text: "#f59e0b", dot: "#f59e0b" },
    Completada: { bg: "rgba(16,185,129,0.10)", text: "#34d399", dot: "#10b981" },
  };
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ position: "relative", width: 280, height: 560, borderRadius: 42, background: "#0d0d0d", border: `1px solid ${BORDER}`, boxShadow: "0 30px 80px rgba(0,0,0,.6)", padding: 14 }}
    >
      <div style={{ position: "absolute", left: "50%", top: 14, transform: "translateX(-50%)", width: 90, height: 7, borderRadius: 4, background: BORDER, zIndex: 3 }} />
      <div style={{ height: "100%", borderRadius: 30, background: "linear-gradient(180deg,#111,#0c0c0c)", overflow: "hidden", padding: "34px 14px 14px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, letterSpacing: "-0.02em" }}>Mis Citas</div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2, textTransform: "capitalize" }}>Viernes, 27 de junio de 2026</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 14 }}>
          {stats.map(s => (
            <div key={s.label} style={{ padding: "10px 10px 8px", borderRadius: 10, background: `color-mix(in srgb, ${s.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${s.color} 18%, transparent)` }}>
              <div style={{ fontSize: 7, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, borderRadius: 12, overflow: "hidden", background: "#161616", border: `1px solid ${BORDER}` }}>
          {appointments.map((apt, i) => {
            const sc = statusColors[apt.status]!;
            return (
              <div key={apt.time} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: withAlpha(BRAND, 0.2), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: BRAND, flexShrink: 0 }}>{apt.name.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{apt.name}</div>
                  <div style={{ fontSize: 9, color: TEXT_MUTED }}>{apt.service}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: sc.text, fontFamily: "monospace", flexShrink: 0 }}>{apt.time}</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 99, fontSize: 8, fontWeight: 600, background: sc.bg, color: sc.text, flexShrink: 0 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: sc.dot }} />{apt.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Página principal ──────────────────────────────────── */
export function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const wipeRef = useRef<HTMLDivElement>(null);
  const [wiped, setWiped] = useState(false);

  useEffect(() => {
    const el = wipeRef.current;
    if (!el || reduceMotion) { setWiped(true); return; }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setWiped(true), 600);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const scrollToSection = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    // behavior: "smooth" diferido (setTimeout) pierde la activación de usuario
    // y el navegador lo descarta en silencio — sin error, sin scroll. "auto"
    // (instantáneo) no depende de esa activación y siempre funciona.
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
    if (menuOpen) {
      setMenuOpen(false);
      setTimeout(scroll, 300);
    } else {
      scroll();
    }
  };

  return (
    <div style={{ background: BG, color: TEXT, minHeight: "100vh", overflowX: "hidden" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only"
        style={{
          position: "fixed",
          top: 8,
          left: 8,
          zIndex: 100,
          background: BRAND,
          color: "#0a0a0a",
          padding: "10px 16px",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Saltar al contenido
      </a>

      {/* ══ Navbar ══════════════════════════════════════════ */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: NAV_HEIGHT,
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          willChange: "transform",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <nav className="landing-nav flex h-full items-center justify-between">
          <a
            href="#inicio"
            onClick={scrollToSection("inicio")}
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <img src="/logo.png" alt="BarberBook" style={{ width: 28, height: 28, objectFit: "contain" }} />
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>BarberBook</span>
          </a>

          <div className="landing-nav-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={scrollToSection(link.id)}
                style={{ fontSize: 14, fontWeight: 500, color: TEXT_MUTED, textDecoration: "none", transition: "color 150ms ease" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
                onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_MUTED)}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="landing-nav-actions">
            <CtaButton to="/login" variant="outline" size="sm">
              Iniciar sesión
            </CtaButton>
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>Acceso exclusivo para administradores y barberos</span>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            className="landing-menu-toggle"
            style={{ background: "none", border: "none", color: TEXT, cursor: "pointer", padding: 4 }}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              style={{ overflow: "hidden", borderTop: `1px solid ${BORDER}`, background: BG }}
              className="landing-mobile-menu"
            >
              <div style={{ display: "flex", flexDirection: "column", padding: "12px 24px 20px", gap: 4 }}>
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    onClick={scrollToSection(link.id)}
                    style={{ padding: "10px 4px", fontSize: 15, fontWeight: 500, color: TEXT, textDecoration: "none" }}
                  >
                    {link.label}
                  </a>
                ))}
                <div style={{ marginTop: 8 }}>
                  <CtaButton to="/login" variant="outline" fullWidth>
                    Iniciar sesión
                  </CtaButton>
                </div>
                <span style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8, textAlign: "center" }}>
                  Acceso exclusivo para administradores y barberos
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content">
        {/* ══ Hero ════════════════════════════════════════════ */}
        <section
          id="inicio"
          style={{
            position: "relative",
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            scrollMarginTop: NAV_HEIGHT,
            isolation: "isolate",
          }}
        >
          {/* Grid background */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-10%",
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 0,
              backgroundImage: `linear-gradient(rgba(156,163,175,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(156,163,175,.05) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(ellipse 75% 65% at 50% 40%, #000 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse 75% 65% at 50% 40%, #000 30%, transparent 75%)",
            }}
          />

          {/* Streaks */}
          {[
            { left: "12%", dur: 7, delay: 0 },
            { left: "34%", dur: 9, delay: 1.5 },
            { left: "63%", dur: 8, delay: 0.8 },
            { left: "84%", dur: 10, delay: 2.4 },
          ].map((s, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="bb-streak"
              style={{
                position: "absolute",
                left: s.left,
                top: 0,
                width: 1,
                height: "100%",
                background: `linear-gradient(180deg, transparent, ${BRAND}, transparent)`,
                opacity: 0.5,
                animation: `bbStreak ${s.dur}s linear ${s.delay}s infinite`,
              }}
            />
          ))}

          {/* Central glow */}
          <div
            aria-hidden="true"
            className="bb-glow"
            style={{
              position: "absolute",
              left: "50%",
              top: "34%",
              width: 680,
              height: 680,
              maxWidth: "120vw",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, rgba(156,163,175,.16), transparent 60%)`,
              filter: "blur(20px)",
              animation: "bbGlow 6s ease-in-out infinite",
              zIndex: 0,
            }}
          />

          {/* Hero content */}
          <div className="landing-hero-inner relative z-10 text-center" style={{ paddingTop: NAV_HEIGHT + 24, paddingBottom: 64 }}>
            <motion.div
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE_OUT }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 17px",
                borderRadius: 999,
                border: `1px solid ${BORDER}`,
                background: "rgba(17,17,17,.6)",
                backdropFilter: "blur(8px)",
                fontSize: 13,
                fontWeight: 500,
                color: ACCENT,
                marginBottom: 38,
              }}
            >
              <span style={{ color: BRAND }}>✦</span> Plataforma SaaS para barberías
            </motion.div>

            <motion.h1
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.09, ease: EASE_OUT }}
              style={{
                fontSize: "clamp(2.8rem, 8.5vw, 6.6rem)",
                fontWeight: 800,
                lineHeight: 0.96,
                letterSpacing: "-0.035em",
                maxWidth: "14ch",
                margin: "0 auto",
                color: TEXT,
              }}
            >
              Gestiona tu barbería <span style={{ color: BRAND }}>de forma inteligente</span>
            </motion.h1>

            <motion.p
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: EASE_OUT }}
              style={{
                fontSize: "clamp(1.05rem, 2.1vw, 1.45rem)",
                fontWeight: 300,
                color: TEXT_MUTED,
                maxWidth: "30ch",
                lineHeight: 1.45,
                margin: "30px auto 0",
              }}
            >
              La plataforma que transforma cómo gestionan las barberías modernas
            </motion.p>

            <motion.div
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.32, ease: EASE_OUT }}
              className="landing-hero-ctas flex flex-col items-center justify-center"
              style={{ marginTop: 42 }}
            >
              <CtaButton href="#contacto" onClick={scrollToSection("contacto")} variant="primary">
                Comenzar ahora →
              </CtaButton>
              <CtaButton to="/demo" variant="primary">
                Probar demo gratuita
              </CtaButton>
              <CtaButton to="/login" variant="outline">
                Iniciar sesión
              </CtaButton>
            </motion.div>
          </div>

        </section>

        {/* ══ Feature Showcase (Qué es) ═══════════════════════ */}
        <section
          id="que-es"
          style={{
            scrollMarginTop: NAV_HEIGHT,
            position: "relative",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "clamp(60px,8vw,100px) 24px clamp(40px,6vw,80px)",
          }}
        >
          <Reveal className="text-center">
            <div style={{ textAlign: "center", marginBottom: 90 }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND }}>La plataforma</span>
              <h2 style={{ margin: "16px 0 0", fontSize: "clamp(2rem,4.5vw,3.4rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.04, color: TEXT }}>
                Todo tu negocio, en un solo lugar
              </h2>
            </div>
          </Reveal>

          {/* Feature 1 — Agendamiento */}
          <div className="showcase-block">
            <Reveal className="showcase-text">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 8, background: withAlpha(BRAND, 0.1), color: BRAND, fontSize: 12, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.04em", marginBottom: 22 }}>
                01 · AGENDAMIENTO
              </div>
              <h3 style={{ margin: 0, fontSize: "clamp(1.8rem,3.6vw,2.8rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.06, color: TEXT }}>
                Tus clientes agendan solos
              </h3>
              <p style={{ margin: "20px 0 0", fontSize: "1.08rem", color: TEXT_MUTED, lineHeight: 1.6, maxWidth: "42ch" }}>
                Carrusel de servicios y barberos pensado para el celular. El cliente elige, reserva y recibe confirmación — sin una sola llamada.
              </p>
              <div style={{ display: "flex", gap: 24, marginTop: 30 }}>
                <div>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>24/7</div>
                  <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>Reservas abiertas</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div>
                  <div style={{ fontSize: "1.9rem", fontWeight: 800, color: BRAND, letterSpacing: "-0.02em" }}>-60%</div>
                  <div style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>Inasistencias</div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.12} className="showcase-visual">
              <BookingPhoneMockup />
            </Reveal>
          </div>

          {/* Feature 2 — Administración */}
          <div className="showcase-block showcase-block--reverse">
            <Reveal className="showcase-visual">
              <DashboardMockup />
            </Reveal>
            <Reveal delay={0.12} className="showcase-text">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 8, background: withAlpha(BRAND, 0.1), color: BRAND, fontSize: 12, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.04em", marginBottom: 22 }}>
                02 · ADMINISTRACIÓN
              </div>
              <h3 style={{ margin: 0, fontSize: "clamp(1.8rem,3.6vw,2.8rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.06, color: TEXT }}>
                Control total de tu negocio
              </h3>
              <p style={{ margin: "20px 0 0", fontSize: "1.08rem", color: TEXT_MUTED, lineHeight: 1.6, maxWidth: "42ch" }}>
                Ingresos, citas, calificaciones y rendimiento por barbero — en tiempo real. Toma decisiones con datos, no con corazonadas.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 13 }}>
                {["Reportes automáticos diarios", "Comisiones calculadas solas", "Inventario y productos"].map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 15, color: ACCENT }}>
                    <span style={{ color: BRAND }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Feature 3 — Panel del Barbero */}
          <div className="showcase-block">
            <Reveal className="showcase-text">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 8, background: withAlpha(BRAND, 0.1), color: BRAND, fontSize: 12, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.04em", marginBottom: 22 }}>
                03 · PANEL DEL BARBERO
              </div>
              <h3 style={{ margin: 0, fontSize: "clamp(1.8rem,3.6vw,2.8rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.06, color: TEXT }}>
                Tu barbero siempre informado
              </h3>
              <p style={{ margin: "20px 0 0", fontSize: "1.08rem", color: TEXT_MUTED, lineHeight: 1.6, maxWidth: "42ch" }}>
                Cada barbero ve su agenda del día, sus próximos clientes y sus ganancias — desde su propio celular, sin enredos.
              </p>
            </Reveal>
            <Reveal delay={0.12} className="showcase-visual">
              <BarberPhoneMockup />
            </Reveal>
          </div>
        </section>

        {/* ══ Diagnóstico IA ══════════════════════════════════ */}
        <section
          style={{
            position: "relative",
            padding: "clamp(90px,12vw,150px) 24px",
            overflow: "hidden",
            background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(156,163,175,.12), transparent 60%), #080808",
          }}
        >
          {/* Glow */}
          <div
            aria-hidden="true"
            className="bb-glow"
            style={{
              position: "absolute",
              left: "50%",
              top: "8%",
              width: 900,
              height: 900,
              maxWidth: "140vw",
              transform: "translateX(-50%)",
              background: "radial-gradient(circle, rgba(156,163,175,.1), transparent 62%)",
              filter: "blur(10px)",
              zIndex: 0,
              animation: "bbGlow 7s ease-in-out infinite",
            }}
          />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 1100, margin: "0 auto" }}>
            <Reveal className="text-center">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 15px",
                  borderRadius: 999,
                  border: `1px solid ${withAlpha(BRAND, 0.3)}`,
                  background: withAlpha(BRAND, 0.07),
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: ACCENT,
                  marginBottom: 30,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: BRAND, boxShadow: `0 0 8px ${BRAND}` }} /> Powered by Google Gemini
              </div>
              <h2 style={{ margin: 0, fontSize: "clamp(2.3rem,6vw,4.6rem)", fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1, color: TEXT }}>
                Inteligencia Artificial
                <br />
                <span style={{ color: BRAND }}>al servicio del estilo</span>
              </h2>
              <p style={{ margin: "26px auto 0", fontSize: "clamp(1.05rem,2vw,1.3rem)", color: TEXT_MUTED, maxWidth: "46ch", lineHeight: 1.5 }}>
                Sube la foto de tu cliente y deja que la IA proponga los cortes perfectos según su rostro.
              </p>
            </Reveal>

            {/* Before / After con wipe */}
            <Reveal delay={0.12}>
              <div style={{ marginTop: 64, display: "flex", flexWrap: "wrap", gap: "clamp(20px,3vw,40px)", justifyContent: "center", alignItems: "stretch" }}>
                {/* ANTES */}
                <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 430 }}>
                  <div style={{ position: "absolute", top: 16, left: 16, zIndex: 3, padding: "6px 13px", borderRadius: 8, background: "rgba(10,10,10,.78)", backdropFilter: "blur(6px)", border: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", fontFamily: "monospace", color: TEXT_MUTED }}>
                    ANTES
                  </div>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "4/5",
                      borderRadius: 22,
                      overflow: "hidden",
                      border: `1px solid ${BORDER}`,
                      background: "#141414",
                    }}
                  >
                    <img src="/indexai_antes.jpeg" alt="Foto original del cliente antes del diagnóstico IA" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                </div>

                {/* RESULTADO IA con wipe */}
                <div ref={wipeRef} style={{ position: "relative", flex: "1 1 320px", maxWidth: 430 }}>
                  <div style={{ position: "absolute", top: 16, left: 16, zIndex: 4, padding: "6px 13px", borderRadius: 8, background: BRAND, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "monospace", color: "#0a0a0a" }}>
                    RESULTADO IA
                  </div>
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: "4/5",
                      borderRadius: 22,
                      overflow: "hidden",
                      border: `1px solid ${withAlpha(BRAND, 0.35)}`,
                      boxShadow: `0 0 50px ${withAlpha(BRAND, 0.18)}`,
                    }}
                  >
                    <img src="/indexai_despues.jpeg" alt="Cuadrícula 2×2 de cortes recomendados por IA" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />

                    {/* Wipe cover */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        background: "linear-gradient(135deg, #0e0e0e, #141414)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 14,
                        transition: "clip-path 1.1s cubic-bezier(.7,0,.2,1)",
                        clipPath: wiped ? "inset(0 0 0 100%)" : "inset(0 0 0 0)",
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${BORDER}`, borderTopColor: BRAND, animation: "bbSpin 1s linear infinite" }} />
                      <div style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: "monospace" }}>Analizando rostro…</div>
                    </div>

                    {/* Wipe edge line */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        width: 2,
                        background: BRAND,
                        boxShadow: `0 0 16px 2px ${BRAND}`,
                        left: wiped ? "0%" : "100%",
                        transition: "left 1.1s cubic-bezier(.7,0,.2,1)",
                        opacity: wiped ? 0 : 0,
                      }}
                      onTransitionEnd={(e) => {
                        if (e.propertyName === "left") {
                          (e.currentTarget as HTMLDivElement).style.opacity = "0";
                        }
                      }}
                      ref={(el) => {
                        if (el && wiped) {
                          el.style.opacity = "1";
                          setTimeout(() => { el.style.opacity = "0"; }, 1150);
                        }
                      }}
                    />
                  </div>

                  {/* Badges */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={wiped ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7, delay: 0.8 }}
                    style={{ display: "none" }}
                  >
                    {null}
                  </motion.div>
                </div>
              </div>
            </Reveal>

            {/* Highlights */}
            <Reveal delay={0.12}>
              <div style={{ marginTop: 36, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
                {["Análisis en menos de 10 segundos", "Basado en tricología científica", "Cortes adaptados a la armonía del rostro"].map(text => (
                  <span key={text} style={{ fontSize: 13, color: TEXT_MUTED, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: BRAND }}>✓</span> {text}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* Info cards */}
            <Reveal delay={0.16}>
              <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
                {[
                  { icon: "◔", title: "Análisis del rostro", desc: "Forma facial, proporciones y línea de cabello detectadas automáticamente." },
                  { icon: "✂", title: "Cortes recomendados", desc: "Cuatro estilos que favorecen al cliente, renderizados sobre su propia foto." },
                  { icon: "◇", title: "Productos sugeridos", desc: "Ceras, pomadas y cuidados ideales para mantener el estilo en casa." },
                ].map((card) => (
                  <motion.div
                    key={card.title}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ padding: 26, borderRadius: 18, background: "#101010", border: `1px solid ${BORDER}`, transition: "border-color 0.3s ease" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = withAlpha(BRAND, 0.4))}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: withAlpha(BRAND, 0.12), display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, fontSize: 20, marginBottom: 18 }}>
                      {card.icon}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: TEXT }}>{card.title}</div>
                    <p style={{ margin: "9px 0 0", fontSize: 14, color: TEXT_MUTED, lineHeight: 1.5 }}>{card.desc}</p>
                  </motion.div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ══ Características ═════════════════════════════════ */}
        <section
          id="caracteristicas"
          style={{
            scrollMarginTop: NAV_HEIGHT,
            position: "relative",
            overflow: "hidden",
            background: "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(156,163,175,.08), transparent 60%), #080808",
            borderTop: `1px solid ${BORDER}`,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div className="landing-section" style={{ maxWidth: 1100, margin: "0 auto" }}>
            <Reveal className="landing-content landing-content--2xl text-center">
              <span style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: BRAND }}>Características</span>
              <h2 style={{ ...sectionTitle, margin: "16px 0 0" }}>Todo lo que necesita tu barbería</h2>
              <p style={{ ...sectionLead, margin: "16px auto 0" }}>
                Desde la primera reserva hasta la fidelización del cliente, cada función está pensada para el flujo
                real de una barbería.
              </p>
            </Reveal>

            <div className="feature-grid">
              {FEATURES.map((feature, i) => (
                <Reveal key={feature.title} delay={(i % 3) * 0.08}>
                  <FeatureCard {...feature} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Planes ═══════════════════════════════════════════ */}
        <section
          id="planes"
          className="landing-section"
          style={{ scrollMarginTop: NAV_HEIGHT, position: "relative", overflow: "hidden" }}
        >
          <BackgroundGradientAnimation
            firstColor="156, 163, 175"
            secondColor="100, 110, 120"
            thirdColor="156, 163, 175"
            fourthColor="130, 140, 155"
            fifthColor="100, 110, 120"
          />
          <div className="landing-content landing-content--5xl" style={{ position: "relative" }}>
            <Reveal className="landing-content landing-content--2xl text-center">
              <h2 style={sectionTitle}>Planes para cada etapa de tu barbería</h2>
              <p style={{ ...sectionLead, margin: "16px auto 0" }}>
                Empieza con lo esencial y activa el plan Premium cuando quieras sumar inteligencia artificial a tu
                servicio.
              </p>
            </Reveal>

            <div className="plans-grid">
              {PLANS.map((plan, i) => (
                <Reveal key={plan.name} delay={i * 0.08}>
                  <PlanCard plan={plan} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══ Contacto ═════════════════════════════════════════ */}
        <section
          id="contacto"
          className="landing-section"
          style={{
            scrollMarginTop: NAV_HEIGHT,
            background: SURFACE,
            borderTop: `1px solid ${BORDER}`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <AmbientGlow style={{ width: 560, height: 360, top: -120, left: "50%", transform: "translateX(-50%)" }} />
          <div className="landing-content landing-content--4xl" style={{ position: "relative" }}>
            <Reveal className="landing-content landing-content--2xl text-center">
              <h2 style={sectionTitle}>Equipo de desarrollo</h2>
              <p style={{ ...sectionLead, margin: "16px auto 0" }}>
                ¿Quieres llevar nuestra plataforma a tu barbería? Escríbenos directamente y te ayudamos con la puesta en
                marcha.
              </p>
            </Reveal>

            <div className="team-grid">
              {TEAM.map((member, i) => (
                <Reveal key={member.email} delay={i * 0.08}>
                  <ContactCard member={member} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ══ Footer ════════════════════════════════════════════ */}
      <footer style={{ background: "#080808", borderTop: `1px solid ${BORDER}` }} className="landing-footer">
        <div className="landing-footer-inner flex flex-col items-center justify-between text-center">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: withAlpha(BRAND, 0.12),
                flexShrink: 0,
              }}
            >
              <img src="/logo.png" alt="BarberBook" style={{ width: 20, height: 20, objectFit: "contain" }} />
            </div>
            <span style={{ fontWeight: 800, letterSpacing: "-0.01em", color: TEXT }}>BarberBook</span>
            <span style={{ fontSize: 13, color: TEXT_MUTED }}>© 2026</span>
          </div>

          <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>Hecho con ♥ en Colombia</p>

          <div style={{ display: "flex", gap: 16 }}>
            <a href="/terms" style={{ fontSize: 13, color: TEXT_MUTED, textDecoration: "none", opacity: 0.6, transition: "opacity 150ms" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}>Términos</a>
            <a href="/privacy" style={{ fontSize: 13, color: TEXT_MUTED, textDecoration: "none", opacity: 0.6, transition: "opacity 150ms" }} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}>Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
