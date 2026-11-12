import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

const BRAND = "#9CA3AF";
const BRAND_LIGHT = "#CBD2D9";
const ACCENT = "#CBD2D9";
const BG = "#0a0a0a";
const SURFACE = "#111111";
const BORDER = "#1e1e1e";
const TEXT = "#f5f5f5";
const MUTED = "#8a8a8a";
const DIMMED = "#6a6a6a";
const RED = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const PURPLE = "#8b5cf6";

const TOTAL_SLIDES = 12;

function withAlpha(hex: string, a: number) {
  return `color-mix(in srgb, ${hex} ${Math.round(a * 100)}%, transparent)`;
}

/* ── Shared sub-components ──────────────────────────────── */

function Logo({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <img
        src="/logo.png"
        alt="BarberBook"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.25),
          objectFit: "contain",
          boxShadow: `0 0 18px rgba(156,163,175,.4)`,
        }}
      />
      <span style={{ fontWeight: 800, fontSize: Math.round(size * 0.5), color: TEXT, letterSpacing: "-0.03em" }}>
        BarberBook
      </span>
    </div>
  );
}

function SlideWrapper({ children, bg = BG }: { children: React.ReactNode; bg?: string }) {
  return (
    <div
      className="demo-slide-wrapper"
      style={{
        width: "100%",
        minHeight: "100%",
        background: bg,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div className="demo-slide-logo" style={{ position: "absolute", top: 24, left: 32, zIndex: 10 }}>
        <Logo size={36} />
      </div>
      {children}
    </div>
  );
}

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 24px 80px rgba(0,0,0,.7)",
        display: "flex",
        flexDirection: "column",
        minHeight: 300,
      }}
    >
      <div
        style={{
          height: 36,
          background: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "0 14px",
          borderBottom: "1px solid #111",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28ca41" }} />
        <div
          style={{
            flex: 1,
            maxWidth: 340,
            height: 22,
            background: "#111",
            borderRadius: 5,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
          }}
        >
          <span style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>{url}</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 280,
        maxWidth: "100%",
        borderRadius: 40,
        border: `2px solid #2a2a2a`,
        background: "#1a1a1a",
        overflow: "hidden",
        boxShadow: "0 32px 80px rgba(0,0,0,.7)",
        flexShrink: 0,
      }}
    >
      <div style={{ background: "#111", padding: "10px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>9:41</span>
        <div style={{ width: 80, height: 18, background: BG, borderRadius: 9 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
            <rect x="0" y="4" width="3" height="7" rx=".5" fill={TEXT} />
            <rect x="4.5" y="2.5" width="3" height="8.5" rx=".5" fill={TEXT} />
            <rect x="9" y="0" width="3" height="11" rx=".5" fill={TEXT} />
          </svg>
        </div>
      </div>
      {children}
      <div style={{ background: "#0f0f0f", height: 26, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 80, height: 4, borderRadius: 2, background: "#333" }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, extra, gradient }: { label: string; value: string; extra: string; gradient: string }) {
  return (
    <div style={{ flex: "0 0 auto", borderRadius: 8, background: gradient, padding: "10px 12px", minWidth: 80 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.75)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 3, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,.7)", marginTop: 3, whiteSpace: "nowrap" }}>{extra}</div>
    </div>
  );
}

function AppointmentRow({ initials: init, name, barber, time, status, statusColor, gradientFrom }: {
  initials: string; name: string; barber: string; time: string; status: string; statusColor: string; gradientFrom: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: "#141414", border: `1px solid ${BORDER}` }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${gradientFrom},${statusColor === GREEN ? ACCENT : statusColor})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "white", flexShrink: 0 }}>{init}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{name}</div>
        <div style={{ fontSize: 10, color: "#555" }}>{barber}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginRight: 6 }}>{time}</div>
      <div style={{ padding: "3px 8px", borderRadius: 16, background: withAlpha(statusColor, 0.12), color: statusColor, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>{status}</div>
    </div>
  );
}

function MiniSidebar({ activeIndex }: { activeIndex: number }) {
  const icons = [
    <svg key="h" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    <svg key="c" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    <svg key="b" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    <svg key="s" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>,
    <svg key="r" width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  ];
  return (
    <div style={{ width: 48, background: "#0e0e0e", borderRight: `1px solid #1a1a1a`, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 3, flexShrink: 0 }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${BRAND},${BRAND_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
      </div>
      {icons.map((icon, i) => (
        <div key={i} style={{ padding: 8, borderRadius: 6, background: i === activeIndex ? withAlpha(BRAND, 0.12) : "transparent", stroke: i === activeIndex ? BRAND : "#444" }}>
          {icon}
        </div>
      ))}
    </div>
  );
}

function PainCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div style={{ padding: "clamp(16px,3vw,28px) clamp(18px,3vw,32px)", borderRadius: 14, background: withAlpha(RED, 0.04), border: `1px solid ${withAlpha(RED, 0.22)}`, display: "flex", alignItems: "flex-start", gap: "clamp(12px,2vw,20px)" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: withAlpha(RED, 0.1), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div>
        <h3 style={{ fontSize: "clamp(15px,2vw,20px)", fontWeight: 700, color: TEXT, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h3>
        <p style={{ fontSize: "clamp(13px,1.5vw,16px)", color: DIMMED, margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

/* ── SLIDES ──────────────────────────────────────────────── */

function Slide01() {
  return (
    <SlideWrapper>
      <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundImage: `linear-gradient(${withAlpha(BRAND, 0.055)} 1px, transparent 1px), linear-gradient(90deg, ${withAlpha(BRAND, 0.055)} 1px, transparent 1px)`, backgroundSize: "64px 64px", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", top: "50%", left: "50%", width: 600, height: 600, background: `radial-gradient(circle, ${withAlpha(BRAND, 0.14)}, transparent 65%)`, transform: "translate(-50%,-50%)", pointerEvents: "none", animation: "demoGlow 14s ease-in-out infinite" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2, textAlign: "center", padding: "clamp(60px,10vh,80px) 24px 20px", gap: "clamp(12px,2vh,28px)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "8px 20px", borderRadius: 999, border: `1px solid ${withAlpha(BRAND, 0.28)}`, background: withAlpha(BRAND, 0.07), fontSize: "clamp(13px,1.5vw,17px)", fontWeight: 500, color: ACCENT }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: BRAND, animation: "demoBlink 2.5s ease-in-out infinite" }} />
          Plataforma SaaS para barberías
        </div>
        <h1 style={{ fontSize: "clamp(1.8rem,5vw,5rem)", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.04em", color: TEXT, margin: 0 }}>
          Gestiona tu barbería<br /><span style={{ color: BRAND }}>de forma inteligente</span>
        </h1>
        <p style={{ fontSize: "clamp(0.9rem,1.8vw,1.5rem)", fontWeight: 400, color: MUTED, maxWidth: 700, lineHeight: 1.45, margin: 0 }}>
          La plataforma que transforma cómo gestionan las barberías modernas
        </p>
        <div style={{ fontSize: 12, color: "#666666", letterSpacing: ".12em", textTransform: "uppercase", marginTop: "auto", paddingBottom: 8 }}>
          usa las flechas para navegar · →
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide02() {
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(24px,4vw,40px)", padding: "80px clamp(24px,5vw,120px) 40px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, color: MUTED, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".12em" }}>Antes de BarberBook</div>
          <h2 style={{ fontSize: "clamp(1.8rem,4.5vw,3.8rem)", fontWeight: 800, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1.08, marginTop: 12 }}>
            ¿Tu barbería todavía<br />funciona así?
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16, width: "100%", maxWidth: 1100 }}>
          <PainCard title="Clientes llaman y no puedes contestar" desc="Pierdes citas mientras trabajas con otro cliente" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.19 12 19.79 19.79 0 0 1 1.15 3.35 2 2 0 0 1 3.12 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z" /></svg>} />
          <PainCard title="Agenda en papel o WhatsApp" desc="Sin control, sin historial, sin profesionalismo" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>} />
          <PainCard title="Citas cruzadas e inasistencias" desc="Confusión, clientes molestos y tiempo perdido" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>} />
          <PainCard title="No sabes cuánto facturaste" desc="Sin métricas reales no puedes hacer crecer tu negocio" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>} />
        </div>
        <div style={{ padding: "16px 40px", borderRadius: 12, background: withAlpha(BRAND, 0.06), border: `1px solid ${withAlpha(BRAND, 0.2)}` }}>
          <p style={{ fontSize: "clamp(15px,2vw,20px)", fontWeight: 600, color: ACCENT, textAlign: "center", margin: 0 }}>
            <span style={{ color: BRAND, fontWeight: 800 }}>BarberBook</span> resuelve todo esto en una sola plataforma.
          </p>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide03() {
  return (
    <SlideWrapper bg="#0c0c0c">
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "80px 24px 40px", gap: "clamp(20px,4vw,60px)", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ flex: "1 1 340px", maxWidth: 560, display: "flex", flexDirection: "column", gap: 32 }}>
          <div>
            <div style={{ fontSize: 14, color: BRAND, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>Booking público 24/7</div>
            <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1.08, margin: "0 0 16px" }}>
              Tus clientes reservan solos, a cualquier hora
            </h2>
            <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, lineHeight: 1.55, margin: 0 }}>Sin llamadas, sin WhatsApp, sin interrupciones. Tu agenda siempre abierta.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { n: "1", t: "Elige el servicio", d: "Carrusel visual con foto, precio y duración", active: true },
              { n: "2", t: "Selecciona el barbero", d: "Especialidad y disponibilidad en tiempo real", active: false },
              { n: "3", t: "Elige fecha y hora", d: "Horarios disponibles en grilla visual", active: false },
              { n: "4", t: "Confirma y listo", d: "Resumen + agrega al calendario .ics", active: false },
            ].map((s) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: s.active ? BRAND : withAlpha(BRAND, 0.25), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: s.active ? "white" : ACCENT, flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: "clamp(14px,1.5vw,17px)", fontWeight: 700, color: TEXT }}>{s.t}</div>
                  <div style={{ fontSize: "clamp(12px,1.2vw,14px)", color: DIMMED }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: withAlpha(BRAND, 0.1), border: `1px solid ${withAlpha(BRAND, 0.25)}`, fontSize: 14, fontWeight: 600, color: ACCENT }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: BRAND, animation: "demoBlink 2s ease-in-out infinite" }} /> 24/7 Reservas
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: withAlpha(GREEN, 0.1), border: `1px solid ${withAlpha(GREEN, 0.25)}`, fontSize: 14, fontWeight: 600, color: "#6ee7b7" }}>
              −60% Inasistencias
            </span>
          </div>
        </div>

        <PhoneMockup>
          <div style={{ background: "#0f0f0f", padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg,${BRAND},${BRAND_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: TEXT }}>Elegant Barber Studio</div>
              <div style={{ fontSize: 9, color: "#555" }}>Reserva en línea</div>
            </div>
          </div>
          <div style={{ background: "#0f0f0f", padding: "8px 16px", display: "flex", justifyContent: "center", gap: 5 }}>
            <div style={{ width: 24, height: 3, borderRadius: 2, background: BRAND }} />
            <div style={{ width: 24, height: 3, borderRadius: 2, background: "#222" }} />
            <div style={{ width: 24, height: 3, borderRadius: 2, background: "#222" }} />
            <div style={{ width: 24, height: 3, borderRadius: 2, background: "#222" }} />
          </div>
          <div style={{ background: "#0f0f0f", padding: "12px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT, marginBottom: 3 }}>Elige tu servicio</div>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 12 }}>Desliza para ver más opciones</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginBottom: 14 }}>
              <div style={{ width: 80, height: 120, borderRadius: 10, background: "#151515", border: `1px solid #222`, opacity: 0.5, transform: "scale(0.9)", padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555" }}>Barba</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#444", marginTop: 4 }}>$18.000</div>
                <div style={{ fontSize: 8, color: "#444", marginTop: 4 }}>30 min</div>
              </div>
              <div style={{ width: 96, height: 136, borderRadius: 12, background: "#141414", border: `2px solid ${BRAND}`, boxShadow: `0 0 20px ${withAlpha(BRAND, 0.3)}`, padding: 10, zIndex: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>Corte degradado</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND, marginTop: 4 }}>$25.000</div>
                <div style={{ fontSize: 8, color: ACCENT, marginTop: 6, padding: "2px 6px", borderRadius: 8, background: withAlpha(BRAND, 0.12), display: "inline-block" }}>45 min</div>
              </div>
              <div style={{ width: 80, height: 120, borderRadius: 10, background: "#151515", border: `1px solid #222`, opacity: 0.5, transform: "scale(0.9)", padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#555" }}>Corte+Barba</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#444", marginTop: 4 }}>$38.000</div>
                <div style={{ fontSize: 8, color: "#444", marginTop: 4 }}>60 min</div>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Horarios — Martes 25</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
              {["9:00", "10:00", "11:00", "14:00"].map((t, i) => (
                <div key={t} style={{ padding: 5, borderRadius: 6, background: i === 2 ? withAlpha(BRAND, 0.18) : "#222", border: i === 2 ? `1px solid ${withAlpha(BRAND, 0.4)}` : "1px solid transparent", textAlign: "center", fontSize: 9, fontWeight: i === 2 ? 700 : 600, color: i === 2 ? ACCENT : "#666", opacity: i === 1 ? 0.4 : 1 }}>{t}</div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: BRAND, textAlign: "center", fontSize: 12, fontWeight: 700, color: "white" }}>Siguiente →</div>
          </div>
        </PhoneMockup>
      </div>
    </SlideWrapper>
  );
}

function Slide04() {
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "80px clamp(16px,4vw,80px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Panel de Administración</h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6 }}>Control total de tu barbería desde un solo lugar</p>
        </div>
        <BrowserChrome url="app.barberbook.co/elegant/dashboard">
          <MiniSidebar activeIndex={0} />
          <div style={{ flex: 1, background: "#0f0f0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 18px", borderBottom: `1px solid #1a1a1a`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>Buenos días, Carlos ☀️</div>
                <div style={{ fontSize: 10, color: "#555" }}>Martes, 24 de junio de 2025</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 16, background: withAlpha(BRAND, 0.08), border: `1px solid ${withAlpha(BRAND, 0.15)}` }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, animation: "demoBlink 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT }}>Elegant Barber Studio</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: "10px 18px", flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <StatCard label="Citas de hoy" value="8" extra="5 complet. · 3 pend." gradient={`linear-gradient(135deg,${BRAND},#1e8ba8)`} />
              <StatCard label="Pendientes" value="3" extra="En espera" gradient="linear-gradient(135deg,#f59e0b,#d97706)" />
              <StatCard label="Barberos" value="3" extra="Carlos · Miguel · Andrés" gradient="linear-gradient(135deg,#8b5cf6,#7c3aed)" />
              <StatCard label="Ingresos" value="$186k" extra="+$94k potencial" gradient="linear-gradient(135deg,#10b981,#059669)" />
              <StatCard label="Clientes" value="47" extra="+3 esta semana" gradient="linear-gradient(135deg,#38bdf8,#0ea5e9)" />
            </div>
            <div style={{ flex: 1, padding: "0 18px 10px", overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Citas de hoy</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <AppointmentRow initials="SH" name="Santiago Herrera" barber="Carlos Méndez · Corte degradado" time="10:00" status="Completada" statusColor={GREEN} gradientFrom={BRAND} />
                <AppointmentRow initials="DR" name="David Ramírez" barber="Miguel Torres · Barba completa" time="11:30" status="Pendiente" statusColor={AMBER} gradientFrom={AMBER} />
                <AppointmentRow initials="CV" name="Camilo Vargas" barber="Andrés Gómez · Corte + Barba" time="14:00" status="Pendiente" statusColor={AMBER} gradientFrom={PURPLE} />
                <AppointmentRow initials="VL" name="Valentina López" barber="Carlos Méndez · Cejas" time="15:30" status="Cancelada" statusColor={RED} gradientFrom="#ec4899" />
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>
    </SlideWrapper>
  );
}

function Slide05() {
  const barbers = [
    { name: "Carlos Méndez", email: "carlos@elegant.co", initials: "CM", color: BRAND, spec: "Degradados y diseños" },
    { name: "Miguel Torres", email: "miguel@elegant.co", initials: "MT", color: PURPLE, spec: "Cortes clásicos" },
    { name: "Andrés Gómez", email: "andres@elegant.co", initials: "AG", color: GREEN, spec: "Barbas y diseños" },
  ];
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "80px clamp(16px,4vw,80px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Gestión de Barberos</h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6 }}>Horarios, credenciales y estados — todo en un clic</p>
        </div>
        <BrowserChrome url="app.barberbook.co/elegant/barberos">
          <MiniSidebar activeIndex={2} />
          <div style={{ flex: 1, background: "#0f0f0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 18px", borderBottom: `1px solid #1a1a1a`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT, margin: 0 }}>Barberos</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, background: BRAND, fontSize: 11, fontWeight: 700, color: "white" }}>+ Nuevo barbero</div>
            </div>
            <div style={{ flex: 1, padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, overflow: "hidden", alignContent: "start" }}>
              {barbers.map((b) => (
                <div key={b.initials} style={{ borderRadius: 10, background: "#141414", border: `1px solid ${BORDER}`, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${b.color},${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>{b.initials}</div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{b.name}</div>
                        <div style={{ fontSize: 9, color: "#555" }}>{b.email}</div>
                      </div>
                    </div>
                    <div style={{ padding: "2px 7px", borderRadius: 16, background: withAlpha(GREEN, 0.12), color: GREEN, fontSize: 9, fontWeight: 700 }}>Activo</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: ACCENT, padding: "3px 8px", borderRadius: 16, background: withAlpha(BRAND, 0.1), alignSelf: "flex-start" }}>{b.spec}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    <div style={{ flex: 1, padding: 5, borderRadius: 6, border: `1px solid ${BORDER}`, textAlign: "center", fontSize: 9, fontWeight: 600, color: MUTED }}>Horario</div>
                    <div style={{ flex: 1, padding: 5, borderRadius: 6, border: `1px solid ${BORDER}`, textAlign: "center", fontSize: 9, fontWeight: 600, color: MUTED }}>Editar</div>
                    <div style={{ flex: 1, padding: 5, borderRadius: 6, border: `1px solid ${withAlpha(RED, 0.2)}`, textAlign: "center", fontSize: 9, fontWeight: 600, color: RED }}>Desact.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BrowserChrome>
      </div>
    </SlideWrapper>
  );
}

function Slide06() {
  const services = [
    { name: "Corte degradado", price: "$25.000", dur: "45 min", active: true, image: "/service-corte-degradado.jpg" },
    { name: "Barba completa", price: "$18.000", dur: "30 min", active: true, image: "/service-barba.webp" },
    { name: "Corte + Barba", price: "$38.000", dur: "60 min", active: true, image: "/service-corte-barba.jpg" },
    { name: "Diseño en cabello", price: "$15.000", dur: "20 min", active: true, image: "/service-diseno.jpg" },
    { name: "Cejas", price: "$8.000", dur: "15 min", active: false, image: "/service-cejas.jpg" },
    { name: "Alisado keratina", price: "$45.000", dur: "90 min", active: true, image: "/service-keratina.webp" },
  ];
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "80px clamp(16px,4vw,80px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Catálogo de Servicios</h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6 }}>Muestra tu menú completo con fotos, precios y duración</p>
        </div>
        <BrowserChrome url="app.barberbook.co/elegant/servicios">
          <MiniSidebar activeIndex={3} />
          <div style={{ flex: 1, background: "#0f0f0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 18px", borderBottom: `1px solid #1a1a1a`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: TEXT, margin: 0 }}>Servicios</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, background: BRAND, fontSize: 11, fontWeight: 700, color: "white" }}>+ Nuevo servicio</div>
            </div>
            <div style={{ flex: 1, padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, overflow: "hidden", alignContent: "start" }}>
              {services.map((s) => (
                <div key={s.name} style={{ borderRadius: 10, background: "#141414", border: `1px solid ${BORDER}`, overflow: "hidden", opacity: s.active ? 1 : 0.5 }}>
                  <img src={s.image} alt={s.name} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{s.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: BRAND }}>{s.price}</span>
                      <span style={{ fontSize: 8, color: ACCENT, padding: "2px 6px", borderRadius: 8, background: withAlpha(BRAND, 0.12) }}>{s.dur}</span>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: s.active ? GREEN : RED }}>{s.active ? "Activo" : "Inactivo"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </BrowserChrome>
      </div>
    </SlideWrapper>
  );
}

function Slide07() {
  const appointments = [
    { time: "4:30", name: "Carlos M.", service: "Fade + Barba", active: true },
    { time: "5:15", name: "Diego P.", service: "Corte clásico", active: false },
    { time: "6:00", name: "Steven G.", service: "Diseño + cejas", active: false },
  ];
  return (
    <SlideWrapper bg="#0c0c0c">
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "80px 24px 40px", gap: "clamp(20px,4vw,60px)", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ flex: "1 1 340px", maxWidth: 560, display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ fontSize: 14, color: BRAND, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>App del barbero</div>
            <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1.08, margin: "0 0 16px" }}>
              Tu barbero siempre informado y listo
            </h2>
            <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, lineHeight: 1.55, margin: 0 }}>Sabe quién viene, a qué hora y qué servicio pidió. Con un toque marca la cita como completada.</p>
          </div>
          {[
            { title: "Completar con un toque", desc: "Botón verde prominente — sin confusiones", color: GREEN, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg> },
            { title: "Horario semanal visible", desc: "Siempre sabe cuándo trabaja y cuándo descansa", color: BRAND, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
            { title: "Ingresos del día", desc: "Ve cuánto ha ganado antes de terminar la jornada", color: AMBER, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
          ].map((f) => (
            <div key={f.title} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: withAlpha(f.color, 0.12), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: "clamp(14px,1.5vw,17px)", fontWeight: 700, color: TEXT }}>{f.title}</div>
                <div style={{ fontSize: "clamp(12px,1.2vw,14px)", color: DIMMED }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <PhoneMockup>
          <div style={{ background: "linear-gradient(180deg,#111,#0c0c0c)", padding: "28px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: BRAND, display: "flex", alignItems: "center", justifyContent: "center", color: BG, fontWeight: 800, fontSize: 14 }}>AR</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: TEXT }}>Andrés R.</div>
                <div style={{ fontSize: 10, color: MUTED }}>Tu jornada · Hoy</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: "linear-gradient(160deg,#17343d,#0f1f24)", border: `1px solid ${withAlpha(BRAND, 0.3)}` }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: BRAND }}>$320k</div>
                <div style={{ fontSize: 9, color: ACCENT, marginTop: 2 }}>Hoy</div>
              </div>
              <div style={{ flex: 1, padding: 10, borderRadius: 10, background: "#161616", border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: TEXT }}>8</div>
                <div style={{ fontSize: 9, color: MUTED, marginTop: 2 }}>Citas</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: "monospace", margin: "16px 0 8px" }}>PRÓXIMAS CITAS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {appointments.map((a) => (
                <div key={a.time} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, background: "#161616", border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.active ? BRAND : MUTED, fontFamily: "monospace" }}>{a.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: MUTED }}>{a.service}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <div style={{ flex: 1, padding: 10, borderRadius: 8, background: GREEN, textAlign: "center", fontSize: 12, fontWeight: 700, color: "white" }}>✓ Completar</div>
              <div style={{ flex: 1, padding: 10, borderRadius: 8, background: withAlpha(RED, 0.15), border: `1px solid ${withAlpha(RED, 0.3)}`, textAlign: "center", fontSize: 12, fontWeight: 700, color: RED }}>Cancelar</div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </SlideWrapper>
  );
}

function Slide08() {
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "80px clamp(16px,4vw,80px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Tu barbería, tu estilo</h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6 }}>Cada barbería se ve diferente — marca propia en minutos</p>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 16, overflow: "hidden", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", borderRadius: 12, background: SURFACE, border: `1px solid ${BORDER}`, padding: 20, display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>Mi Barbería — Branding</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Logo</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: `linear-gradient(135deg,${BRAND},${BRAND_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px ${withAlpha(BRAND, 0.3)}` }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
                </div>
                <div style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px dashed #2a2a2a", background: "#0f0f0f", fontSize: 10, color: "#444", textAlign: "center" }}>Subir nuevo logo</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Colores de marca</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[{ label: "Principal", color: BRAND, hex: "#9CA3AF" }, { label: "Secundario", color: "#6366f1", hex: "#6366f1" }].map((c) => (
                  <div key={c.label} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>{c.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 7, background: "#0f0f0f", border: "1px solid #222" }}>
                      <div style={{ width: 24, height: 24, borderRadius: 5, background: c.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: ACCENT }}>{c.hex}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>Tema visual</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { name: "Dark Premium", bg: "#0a0a0a", border: BRAND },
                  { name: "Antigravity", bg: "#0c0a1a", border: "#6366f1" },
                  { name: "Light", bg: "#f5f5f5", border: "#ddd" },
                ].map((t) => (
                  <div key={t.name} style={{ flex: 1, padding: 8, borderRadius: 7, background: t.bg, border: `2px solid ${t.name === "Dark Premium" ? t.border : "transparent"}`, textAlign: "center" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, color: t.name === "Light" ? "#333" : TEXT }}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {[{ label: "WhatsApp", on: true }, { label: "Fidelización", on: true }].map((f) => (
                <div key={f.label} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 7, background: "#0f0f0f", border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: TEXT }}>{f.label}</span>
                  <div style={{ width: 32, height: 18, borderRadius: 9, background: f.on ? GREEN : "#333", position: "relative" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: f.on ? 16 : 2, transition: "left 0.2s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "1 1 300px", borderRadius: 12, background: "#0c0c0c", border: `1px solid ${BORDER}`, padding: 20, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em" }}>Vista previa en vivo</div>
            <div style={{ borderRadius: 10, background: "#0f0f0f", border: `1px solid ${BORDER}`, padding: 16, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${BRAND},${BRAND_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>Elegant Barber Studio</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 8 }}>Selecciona tu servicio</div>
              {["Corte degradado — $25.000", "Barba completa — $18.000"].map((s) => (
                <div key={s} style={{ padding: "8px 10px", borderRadius: 7, background: "#141414", border: `1px solid ${BORDER}`, marginBottom: 6, fontSize: 11, color: TEXT }}>{s}</div>
              ))}
              <div style={{ marginTop: 10, padding: 8, borderRadius: 7, background: BRAND, textAlign: "center", fontSize: 11, fontWeight: 700, color: "white" }}>Reservar ahora</div>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide09() {
  return (
    <SlideWrapper bg="#0c0c0c">
      <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "80px 24px 40px", gap: "clamp(20px,4vw,60px)", flexWrap: "wrap", justifyContent: "center" }}>
        <PhoneMockup>
          <div style={{ background: "#1f2c34", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #2a3942" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${BRAND},${BRAND_LIGHT})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e9edef" }}>BarberBook — Elegant</div>
              <div style={{ fontSize: 9, color: "#8696a0" }}>Sistema de recordatorios</div>
            </div>
          </div>
          <div style={{ background: "#0b141a", padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 300 }}>
            <div style={{ textAlign: "center" }}><span style={{ fontSize: 8, color: "#8696a0", background: "#182229", padding: "3px 8px", borderRadius: 8 }}>HOY</span></div>
            <div style={{ maxWidth: 220, background: "#202c33", borderRadius: "0 10px 10px 10px", padding: "8px 10px" }}>
              <div style={{ fontSize: 9, color: "#e9edef", lineHeight: 1.5, marginBottom: 6 }}>
                🗓 <span style={{ fontWeight: 700 }}>Recordatorio de cita</span><br />
                Te esperamos mañana:<br />
                <span style={{ color: "#25d366" }}>✂️ Servicio:</span> Corte degradado<br />
                <span style={{ color: "#25d366" }}>🕐 Hora:</span> 11:00 AM<br />
                <span style={{ color: "#25d366" }}>💈 Barbero:</span> Carlos Méndez
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ flex: 1, padding: 5, borderRadius: 6, background: "#25d366", textAlign: "center", fontSize: 9, fontWeight: 700, color: "white" }}>Confirmar ✓</div>
                <div style={{ flex: 1, padding: 5, borderRadius: 6, background: withAlpha(RED, 0.2), textAlign: "center", fontSize: 9, fontWeight: 700, color: RED }}>Cancelar ✗</div>
              </div>
            </div>
            <div style={{ maxWidth: 220, background: "#202c33", borderRadius: "0 10px 10px 10px", padding: "8px 10px", marginTop: 4 }}>
              <div style={{ fontSize: 9, color: "#e9edef", lineHeight: 1.5 }}>
                🔄 <span style={{ fontWeight: 700 }}>¿Necesitas reprogramar?</span><br />
                Toca el botón para elegir otro horario:
              </div>
              <div style={{ marginTop: 6, padding: 5, borderRadius: 6, background: withAlpha(BRAND, 0.2), border: `1px solid ${withAlpha(BRAND, 0.4)}`, textAlign: "center", fontSize: 9, fontWeight: 700, color: ACCENT }}>📅 Reprogramar cita</div>
            </div>
            <div style={{ alignSelf: "flex-end", maxWidth: 180, background: "#005c4b", borderRadius: "10px 0 10px 10px", padding: "6px 10px" }}>
              <div style={{ fontSize: 9, color: "#e9edef" }}>¡Perfecto! Ahí estaré, gracias 👍</div>
            </div>
          </div>
        </PhoneMockup>

        <div style={{ flex: "1 1 340px", maxWidth: 560, display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ fontSize: 14, color: "#25d366", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>WhatsApp Business API</div>
            <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1.08, margin: "0 0 16px" }}>
              Recordatorios automáticos que reducen inasistencias
            </h2>
            <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, lineHeight: 1.55, margin: 0 }}>El sistema envía recordatorios 1 hora antes. El cliente confirma, cancela o reprograma desde WhatsApp. Cero intervención manual.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Envío automático 1 hora antes", color: "#25d366" },
              { label: "Botones interactivos de confirmación", color: BRAND },
              { label: "Reprogramación directa desde el mensaje", color: AMBER },
            ].map((f) => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: withAlpha(f.color, 0.06), border: `1px solid ${withAlpha(f.color, 0.2)}` }}>
                <span style={{ color: f.color, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide10() {
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "80px clamp(16px,4vw,100px) 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(66,133,244,.1)", border: "1px solid rgba(66,133,244,.25)", marginBottom: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4285F4" /><path d="m2 17 10 5 10-5" stroke="#EA4335" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="m2 12 10 5 10-5" stroke="#FBBC05" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#9ab8f8" }}>Powered by Google Gemini — Plan Premium</span>
        </div>
        <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.035em", textAlign: "center" }}>Diagnóstico de corte con IA</h2>
        <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6, textAlign: "center" }}>El barbero impresiona al cliente — diferenciador real en el mercado</p>

        <div style={{ flex: 1, display: "flex", gap: "clamp(16px,3vw,32px)", marginTop: 24, width: "100%", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          <div style={{ flex: "1 1 250px", maxWidth: 500, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", maxWidth: 240, borderRadius: 14, overflow: "hidden", border: `1px solid ${BORDER}`, position: "relative" }}>
              <img src="/ai-antes.jpeg" alt="Antes" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(0,0,0,0.7)", fontSize: 10, fontWeight: 700, color: TEXT, letterSpacing: "0.06em" }}>ANTES</span>
            </div>
            <div style={{ flex: "1 1 200px", maxWidth: 240, borderRadius: 14, overflow: "hidden", border: `1px solid ${BRAND}`, position: "relative", boxShadow: `0 0 20px ${withAlpha(BRAND, 0.2)}` }}>
              <img src="/ai-resultado.png" alt="Resultado IA" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", borderRadius: 6, background: withAlpha(BRAND, 0.8), fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.06em" }}>RESULTADO IA</span>
            </div>
          </div>

          <div style={{ flex: "1 1 200px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "◔", title: "Análisis del rostro", desc: "Forma facial, proporciones y línea de cabello detectadas automáticamente." },
              { icon: "✂", title: "Cortes recomendados", desc: "Cuatro estilos renderizados sobre la foto del cliente." },
              { icon: "◇", title: "Productos sugeridos", desc: "Ceras, pomadas y cuidados ideales para mantener el estilo." },
            ].map((c) => (
              <div key={c.title} style={{ padding: 16, borderRadius: 12, background: "#101010", border: `1px solid ${BORDER}` }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: withAlpha(BRAND, 0.12), display: "flex", alignItems: "center", justifyContent: "center", color: BRAND, fontSize: 16, marginBottom: 10 }}>{c.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{c.title}</div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide11() {
  return (
    <SlideWrapper>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "80px clamp(16px,4vw,80px) 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: "clamp(1.5rem,3.5vw,2.8rem)", fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Clientes que regresan y te recomiendan</h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 6 }}>Fidelización automática + reseñas con QR</p>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 16, overflow: "hidden", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px", borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}`, padding: 20, display: "flex", flexDirection: "column", gap: 18, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: withAlpha(AMBER, 0.12), display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBER} strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>Programa de Fidelización</div>
                <div style={{ fontSize: 12, color: "#555" }}>Acumula citas, gana cortes gratis</div>
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#0f0f0f", border: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg,${BRAND},${ACCENT})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>SH</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Santiago Herrera</div>
                  <div style={{ fontSize: 10, color: "#555" }}>Cliente desde Mar 2024</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>5 / 10 citas</span>
                <span style={{ fontSize: 11, color: AMBER, fontWeight: 600 }}>50%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: BORDER, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "50%", borderRadius: 4, background: `linear-gradient(90deg,${AMBER},#fbbf24)` }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", background: i < 5 ? withAlpha(AMBER, 0.2) : "#1a1a1a", border: `1px solid ${i < 5 ? withAlpha(AMBER, 0.4) : "#222"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: i < 5 ? AMBER : "#333" }}>
                    {i < 5 ? "★" : "○"}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 8, background: withAlpha(GREEN, 0.06), border: `1px solid ${withAlpha(GREEN, 0.2)}`, fontSize: 12, fontWeight: 600, color: "#6ee7b7", textAlign: "center" }}>
              🎉 5 citas más y obtiene un corte GRATIS
            </div>
          </div>

          <div style={{ flex: "1 1 300px", borderRadius: 14, background: SURFACE, border: `1px solid ${BORDER}`, padding: 20, display: "flex", flexDirection: "column", gap: 18, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: withAlpha(BRAND, 0.12), display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BRAND} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: TEXT }}>Reseñas con QR</div>
                <div style={{ fontSize: 12, color: "#555" }}>Genera confianza y visibilidad</div>
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: "#0f0f0f", border: `1px solid ${BORDER}`, textAlign: "center" }}>
              <div style={{ width: 100, height: 100, margin: "0 auto 12px", borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 80, height: 80, background: `repeating-conic-gradient(#333 0 25%, white 0 50%)`, backgroundSize: "10px 10px" }} />
              </div>
              <div style={{ fontSize: 11, color: MUTED }}>Escanea para dejar tu reseña</div>
              <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>barberbook.co/review/elegant</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: TEXT }}>4.8</span>
              <div>
                <div style={{ color: AMBER, fontSize: 14, letterSpacing: 2 }}>★★★★★</div>
                <div style={{ fontSize: 10, color: MUTED }}>47 reseñas</div>
              </div>
            </div>
            {[
              { name: "María G.", stars: 5, text: "Excelente servicio, siempre puntuales" },
              { name: "Diego R.", stars: 4, text: "Muy buen corte, volvería sin dudar" },
            ].map((r) => (
              <div key={r.name} style={{ padding: 10, borderRadius: 8, background: "#0f0f0f", border: `1px solid ${BORDER}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: TEXT }}>{r.name}</span>
                  <span style={{ fontSize: 10, color: AMBER }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                </div>
                <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function Slide12({ onContact }: { onContact?: () => void }) {
  const plans = [
    { name: "Plan Estándar", price: "$65.000", highlight: false, features: ["Panel de administración", "Gestión de barberos y horarios", "Gestión de servicios", "Agenda y citas", "Base de clientes", "Reseñas con QR", "Booking público con fotos", "Recordatorios por WhatsApp"] },
    { name: "Plan Premium", price: "$100.000", highlight: true, features: ["Todo lo del Plan Estándar", "100 diagnósticos de cortes con IA al mes", "Soporte prioritario"] },
    { name: "Plan Premium Ilimitado", price: "$200.000", highlight: false, features: ["Todo lo del Plan Premium", "Diagnósticos de cortes con IA ilimitados", "Soporte prioritario"] },
  ];
  return (
    <SlideWrapper>
      <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "20%", left: "15%", width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle,${withAlpha(BRAND, 0.15)},transparent 70%)`, filter: "blur(50px)", animation: "demoBlob1 28s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "40%", right: "10%", width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle,${withAlpha(PURPLE, 0.12)},transparent 70%)`, filter: "blur(50px)", animation: "demoBlob2 35s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "30%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle,${withAlpha(GREEN, 0.1)},transparent 70%)`, filter: "blur(60px)", animation: "demoBlob3 32s ease-in-out infinite" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "clamp(24px,4vw,40px)", padding: "80px clamp(24px,4vw,100px) 40px", position: "relative", zIndex: 2 }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.8rem,4.5vw,3.6rem)", fontWeight: 800, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1.08, margin: 0 }}>
            Elige el plan que se ajuste a tu barbería
          </h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,18px)", color: DIMMED, marginTop: 12 }}>Sin contrato · Configuración en minutos · Soporte humano</p>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 1160 }}>
          {plans.map((p) => (
            <div key={p.name} style={{ flex: "1 1 280px", maxWidth: 360, padding: "clamp(20px,3vw,32px) clamp(18px,2.5vw,28px)", borderRadius: 16, background: p.highlight ? `linear-gradient(160deg, ${withAlpha(BRAND, 0.1)}, ${withAlpha(BRAND, 0.02)} 60%)` : SURFACE, border: `1px solid ${p.highlight ? withAlpha(BRAND, 0.5) : BORDER}`, position: "relative" }}>
              {p.highlight && <span style={{ position: "absolute", top: -11, left: 24, background: BRAND, color: BG, fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", padding: "3px 10px", borderRadius: 999 }}>Más popular</span>}
              <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: "0 0 6px" }}>{p.name}</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: TEXT }}>{p.price}</span>
                <span style={{ fontSize: 12, color: MUTED }}>COP/mes</span>
              </div>
              <ul style={{ listStyle: "none", margin: "0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: TEXT }}>
                    <span style={{ color: BRAND, flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={onContact} style={{ display: "block", width: "100%", padding: "10px 20px", borderRadius: 8, background: p.highlight ? BRAND : "transparent", border: `1px solid ${BRAND}`, textAlign: "center", fontSize: 13, fontWeight: 700, color: p.highlight ? BG : BRAND, cursor: "pointer" }}>Comenzar ahora</button>
            </div>
          ))}
        </div>
      </div>
    </SlideWrapper>
  );
}

/* ── Slide registry ─────────────────────────────────────── */

const SLIDES = [Slide01, Slide02, Slide03, Slide04, Slide05, Slide06, Slide07, Slide08, Slide09, Slide10, Slide11, Slide12];

const SLIDE_LABELS = [
  "Portada", "El Problema", "Agendamiento", "Dashboard", "Barberos", "Servicios",
  "Panel Barbero", "Branding", "WhatsApp", "IA", "Fidelización", "Planes",
];

/* ── Main component ─────────────────────────────────────── */

export function DemoPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);

  const goTo = useCallback((index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  }, [current]);

  const next = useCallback(() => { if (current < TOTAL_SLIDES - 1) goTo(current + 1); }, [current, goTo]);
  const prev = useCallback(() => { if (current > 0) goTo(current - 1); }, [current, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, navigate]);

  const goToContact = useCallback(() => {
    navigate("/");
    const tryScroll = (attempts: number) => {
      const el = document.getElementById("contacto");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts > 0) {
        setTimeout(() => tryScroll(attempts - 1), 150);
      }
    };
    setTimeout(() => tryScroll(10), 200);
  }, [navigate]);

  const SlideComponent = SLIDES[current];

  const navBtn: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: `1px solid ${BORDER}`,
    background: "rgba(17,17,17,.85)",
    backdropFilter: "blur(8px)",
    color: TEXT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: 18,
    transition: "background 150ms, border-color 150ms",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, right: 0, bottom: 0, left: 0,
        background: BG,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes demoGlow { 0%,100% { opacity:.11; transform:translate(-50%,-50%) scale(1) } 50% { opacity:.27; transform:translate(-50%,-50%) scale(1.22) } }
        @keyframes demoBlink { 0%,100% { opacity:1 } 50% { opacity:.15 } }
        @keyframes demoBlob1 { 0%,100% { transform:translate(0,0) scale(1) } 33% { transform:translate(120px,-80px) scale(1.1) } 66% { transform:translate(-60px,100px) scale(.92) } }
        @keyframes demoBlob2 { 0%,100% { transform:translate(0,0) scale(1) } 40% { transform:translate(-100px,70px) scale(.87) } 70% { transform:translate(90px,-90px) scale(1.1) } }
        @keyframes demoBlob3 { 0%,100% { transform:translate(0,0) scale(1) } 30% { transform:translate(70px,80px) scale(1.08) } 65% { transform:translate(-80px,-60px) scale(.95) } }
        @keyframes demoRotatePhone { 0%,100% { transform:rotate(0deg) } 25% { transform:rotate(-90deg) } 50%,75% { transform:rotate(-90deg) } }
      `}</style>

      {/* Close button */}
      <button
        onClick={() => navigate("/")}
        aria-label="Cerrar demo"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 100,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `1px solid ${BORDER}`,
          background: "rgba(17,17,17,.85)",
          backdropFilter: "blur(8px)",
          color: TEXT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Slide area */}
      <div
        style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }}
        onTouchStart={e => { touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (!touchRef.current) return;
          const dx = e.changedTouches[0].clientX - touchRef.current.startX;
          const dy = e.changedTouches[0].clientY - touchRef.current.startY;
          touchRef.current = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) next(); else prev();
          }
        }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            initial={{ opacity: 0, x: direction * 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 80 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}
          >
            {current === 11 ? <SlideComponent onContact={goToContact} /> : <SlideComponent />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px calc(12px + env(safe-area-inset-bottom, 0px)) 14px",
          borderTop: `1px solid ${BORDER}`,
          background: "rgba(10,10,10,.95)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
          gap: 10,
        }}
      >
        <button onClick={prev} disabled={current === 0} style={{ ...navBtn, width: 36, height: 36, fontSize: 16, opacity: current === 0 ? 0.3 : 1, cursor: current === 0 ? "default" : "pointer", flexShrink: 0 }} aria-label="Anterior">
          ←
        </button>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, overflow: "hidden", minWidth: 0 }}>
          {SLIDE_LABELS.map((_label, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir a slide ${i + 1}`}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                padding: 0,
                background: i === current ? BRAND : i < current ? withAlpha(BRAND, 0.4) : "#2a2a2a",
                border: "none",
                cursor: "pointer",
                transition: "all 250ms ease",
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        <span style={{ fontSize: 12, color: MUTED, fontFamily: "monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
          {current + 1}/{TOTAL_SLIDES}
        </span>

        <button onClick={next} disabled={current === TOTAL_SLIDES - 1} style={{ ...navBtn, width: 36, height: 36, fontSize: 16, opacity: current === TOTAL_SLIDES - 1 ? 0.3 : 1, cursor: current === TOTAL_SLIDES - 1 ? "default" : "pointer", flexShrink: 0 }} aria-label="Siguiente">
          →
        </button>
      </div>
    </div>
  );
}