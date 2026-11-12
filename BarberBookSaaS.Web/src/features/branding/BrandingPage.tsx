import React, { useCallback, useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { QRCodeSVG } from "qrcode.react";
import { brandingService } from "./brandingService";
import { customerService } from "../customers/customerService";
import { serviceService } from "../services/serviceService";
import type { Service } from "../services/serviceTypes";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import type { TenantBranding } from "./brandingTypes";

/* ── Theme presets ──────────────────────────────────────── */
const THEMES = [
  {
    id: "dark-premium",
    name: "Dark Premium",
    desc: "Fondo oscuro, detalles dorados",
    bg: "#0a0a0a",
    sidebar: "#111111",
  },
  {
    id: "antigravity",
    name: "Antigravity",
    desc: "Glassmorphism azul violeta",
    bg: "#0f0c29",
    sidebar: "#1a1744",
  },
  {
    id: "light-modern",
    name: "Light Modern",
    desc: "Limpio y profesional, estilo Notion",
    bg: "#f8fafc",
    sidebar: "#ffffff",
  },
];

/* ── Section card wrapper ───────────────────────────────── */
const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  cardRef?: React.Ref<HTMLDivElement>;
  delay?: number;
}> = ({ title, subtitle, children, cardRef, delay = 0 }) => (
  <div
    ref={cardRef}
    className="fade-up"
    style={{
      borderRadius: "20px",
      padding: "26px 28px",
      background: "var(--color-glass-surface)",
      border: "1px solid var(--color-glass-border)",
      animationDelay: `${delay}ms`,
    }}
  >
    <div style={{ marginBottom: "20px" }}>
      <h2 style={{
        color: "var(--color-text)", fontSize: 18, fontWeight: 800,
        letterSpacing: "-0.02em", lineHeight: 1.2,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 5 }}>
          {subtitle}
        </p>
      )}
    </div>
    {children}
  </div>
);

/* ── Main component ─────────────────────────────────────── */
export const BrandingPage: React.FC = () => {
  const { primaryColor: ctxPrimary, secondaryColor: ctxSecondary, theme: ctxTheme, logoBase64: ctxLogo, tenantName: ctxName, applyBranding } = useTheme();
  const { tenantId } = useAuth();

  const [branding, setBranding]               = useState<TenantBranding | null>(null);
  const [selectedTheme, setSelectedTheme]     = useState(ctxTheme);
  const [primaryColor, setPrimaryColor]       = useState(ctxPrimary);
  const [secondaryColor, setSecondaryColor]   = useState(ctxSecondary);
  const [activePicker, setActivePicker]       = useState<"primary" | "secondary" | null>(null);
  const [logoFile, setLogoFile]               = useState<File | null>(null);
  const [logoPreview, setLogoPreview]         = useState<string | null>(null);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [whatsAppEnabled, setWhatsAppEnabled]   = useState(false);
  const [whatsAppPhone, setWhatsAppPhone]       = useState("");
  const [savingWA, setSavingWA]                 = useState(false);
  const [savedWA, setSavedWA]                   = useState(false);
  const [holidaysEnabled, setHolidaysEnabled]   = useState(false);
  const [savingHolidays, setSavingHolidays]     = useState(false);
  const [savedHolidays, setSavedHolidays]       = useState(false);
  const [tenantName, setTenantName]             = useState("");
  const [savingName, setSavingName]             = useState(false);
  const [savedName, setSavedName]               = useState(false);
  const [address, setAddress]                   = useState("");
  const [savingAddress, setSavingAddress]       = useState(false);
  const [savedAddress, setSavedAddress]         = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled]     = useState(false);
  const [loyaltyThreshold, setLoyaltyThreshold] = useState(10);
  const [loyaltyInput, setLoyaltyInput]         = useState("10");
  const [loyaltyRewardServiceId, setLoyaltyRewardServiceId] = useState<string | null>(null);
  const [savingLoyalty, setSavingLoyalty]       = useState(false);
  const [savedLoyalty, setSavedLoyalty]         = useState(false);
  const [servicesList, setServicesList]         = useState<Service[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    brandingService.getBranding().then((b) => {
      setBranding(b);
      setSelectedTheme(b.theme || "dark-premium");
      setPrimaryColor(b.primaryColor || "#D4AF37");
      setSecondaryColor(b.secondaryColor || "#6366F1");
      setTenantName(b.name ?? ctxName ?? "");
      setWhatsAppEnabled(b.whatsAppEnabled ?? false);
      setWhatsAppPhone(b.whatsAppPhone ?? "");
      setHolidaysEnabled(b.holidaysEnabled ?? false);
      setAddress(b.address ?? "");
    });
    customerService.getLoyaltyConfig().then((cfg) => {
      setLoyaltyEnabled(cfg.enabled);
      setLoyaltyThreshold(cfg.threshold);
      setLoyaltyInput(String(cfg.threshold));
      setLoyaltyRewardServiceId(cfg.rewardServiceId);
    }).catch(() => {});
    serviceService.getAll().then((svcs) => {
      setServicesList(svcs.filter(s => s.isActive));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePicker(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveAppearance = useCallback((theme: string, primary: string, secondary: string) => {
    applyBranding(theme, primary, secondary);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await brandingService.updateBranding({ theme, primaryColor: primary, secondaryColor: secondary });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {
        setError("Error al guardar. Intenta de nuevo.");
        setTimeout(() => setError(null), 3000);
      }
    }, 600);
  }, [applyBranding]);

  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
    autoSaveAppearance(theme, primaryColor, secondaryColor);
  };
  const handlePrimaryChange = (color: string) => {
    setPrimaryColor(color);
    autoSaveAppearance(selectedTheme, color, secondaryColor);
  };
  const handleSecondaryChange = (color: string) => {
    setSecondaryColor(color);
    autoSaveAppearance(selectedTheme, primaryColor, color);
  };

  const handleSaveLogo = async () => {
    if (!logoFile) return;
    setSaving(true); setError(null);
    try {
      await brandingService.uploadLogo(logoFile);
      const updated = await brandingService.getBranding();
      setBranding(updated);
      applyBranding(selectedTheme, primaryColor, secondaryColor, updated.logoBase64 ?? null);
      setLogoFile(null);
      setLogoPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown } };
      const data = e?.response?.data;
      const message = typeof data === "string" ? data : (data as { message?: string } | undefined)?.message;
      setError(message ?? "Error al guardar. Intenta de nuevo.");
    }
    finally { setSaving(false); }
  };

  const handleSaveWA = async () => {
    setSavingWA(true);
    try {
      await brandingService.updateWhatsApp(whatsAppEnabled, whatsAppPhone);
      setSavedWA(true);
      setTimeout(() => setSavedWA(false), 2500);
    } finally { setSavingWA(false); }
  };

  const handleSaveLoyalty = async () => {
    setSavingLoyalty(true);
    try {
      await customerService.updateLoyaltyConfig(loyaltyEnabled, loyaltyThreshold, loyaltyRewardServiceId);
      setSavedLoyalty(true);
      setTimeout(() => setSavedLoyalty(false), 2500);
    } finally { setSavingLoyalty(false); }
  };

  const logoSource = branding?.logoBase64 ?? ctxLogo;
  const currentLogo =
    logoPreview ||
    (logoSource
      ? logoSource.startsWith("data:")
        ? logoSource
        : `data:image/png;base64,${logoSource}`
      : null);

  const accent = ctxPrimary;

  return (
    <div className="fade-up" style={{ maxWidth: "52rem", display: "flex", flexDirection: "column", gap: "18px", paddingBottom: "48px" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
          background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
        }} />
        <div>
          <h1 style={{ color: "var(--color-text)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Mi Barbería
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 6 }}>
            Personaliza la apariencia de tu panel y tu página pública.
          </p>
        </div>
      </div>

      {/* ── Identidad visual (logo) ──────────────────────────── */}
      <SectionCard title="Identidad visual" subtitle="Sube el logo de tu barbería. Aparecerá en el panel y en la página de reservas." delay={40}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{
            width: 80, height: 80, borderRadius: 16, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            border: "2px solid var(--color-glass-border)",
            background: "color-mix(in srgb, var(--color-bg) 60%, var(--color-glass-surface))",
          }}>
            {currentLogo ? (
              <img src={currentLogo} alt="Logo de la barbería" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 32 }}>✂</span>
            )}
          </div>
          <div>
            <label
              className="btn-primary"
              style={{ display: "inline-flex", alignItems: "center", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Subir logo
              <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={handleLogoChange} />
            </label>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 8 }}>
              PNG o JPG, máximo 2 MB
            </p>
            {logoFile && (
              <button
                onClick={handleSaveLogo}
                disabled={saving}
                className="btn-primary"
                style={{ marginTop: 10, padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Guardando..." : "Guardar logo"}
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Nombre de la barbería ───────────────────────────── */}
      <SectionCard title="Nombre de la barbería" subtitle="Aparece en el panel lateral y en tu página pública de reservas." delay={50}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            type="text"
            placeholder="Ej: Barbería Premium"
            value={tenantName}
            onChange={e => setTenantName(e.target.value)}
            maxLength={80}
            className="input-theme"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}
          />
          <button
            onClick={async () => {
              if (!tenantName.trim()) return;
              setSavingName(true);
              try {
                await brandingService.updateName(tenantName.trim());
                applyBranding(selectedTheme, primaryColor, secondaryColor, undefined, tenantName.trim());
                setSavedName(true);
                setTimeout(() => setSavedName(false), 2500);
              } catch {
                /* ignore */
              } finally { setSavingName(false); }
            }}
            disabled={savingName || !tenantName.trim()}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (savingName || !tenantName.trim()) ? 0.6 : 1 }}
          >
            {savingName ? "Guardando..." : savedName ? "Guardado" : "Guardar nombre"}
          </button>
        </div>
      </SectionCard>

      {/* ── Dirección de la barbería ─────────────────────────── */}
      <SectionCard title="Dirección" subtitle="Dirección física de tu barbería." delay={60}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <input
              type="text"
              placeholder="Ej: Calle 85 #15-23, Bogotá"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input-theme"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}
            />
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              📍 Escribe la dirección completa para que tus clientes puedan ubicarte en Google Maps
            </p>
          </div>
          <button
            onClick={async () => {
              setSavingAddress(true);
              try {
                await brandingService.updateAddress(address);
                setSavedAddress(true);
                setTimeout(() => setSavedAddress(false), 2500);
              } finally { setSavingAddress(false); }
            }}
            disabled={savingAddress}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingAddress ? 0.6 : 1 }}
          >
            {savingAddress ? "Guardando..." : savedAddress ? "Guardado" : "Guardar dirección"}
          </button>
        </div>
      </SectionCard>

      {/* ── Colores de marca ─────────────────────────────────── */}
      <SectionCard
        title="Colores de marca"
        subtitle="El color principal se aplica en botones, acentos y elementos destacados. El secundario se usa en degradados y detalles."
        cardRef={pickerRef}
        delay={80}
      >
        <div className="brand-color-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {(
            [
              { key: "primary" as const,   label: "Color principal",   color: primaryColor,   set: handlePrimaryChange   },
              { key: "secondary" as const, label: "Color secundario",  color: secondaryColor, set: handleSecondaryChange },
            ]
          ).map(({ key, label, color, set }) => (
            <div key={key}>
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                {label}
              </p>
              <button
                onClick={() => setActivePicker(activePicker === key ? null : key)}
                style={{
                  width: "100%", height: 44, borderRadius: 10, padding: "0 12px",
                  display: "flex", alignItems: "center", gap: 10,
                  background: color, border: "none", cursor: "pointer",
                  transition: "opacity 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                  {color.toUpperCase()}
                </span>
              </button>
              {activePicker === key && (
                <div style={{ marginTop: 10 }}>
                  <HexColorPicker color={color} onChange={set} style={{ width: "100%" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {(saved || error) && (
          <p style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: error ? "#f87171" : "#34d399" }}>
            {error || "✓ Guardado"}
          </p>
        )}
      </SectionCard>

      {/* ── Tema base ────────────────────────────────────────── */}
      <SectionCard title="Tema base" subtitle="Elige la paleta visual del panel de administración." delay={120}>
        <div className="theme-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {THEMES.map((t) => {
            const active = selectedTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                style={{
                  borderRadius: 14, padding: 14, textAlign: "left",
                  background: t.bg,
                  border: active ? `2px solid ${primaryColor}` : "2px solid transparent",
                  boxShadow: active ? `0 0 0 1px ${primaryColor}` : undefined,
                  cursor: "pointer",
                  transition: "transform 150ms ease, border-color 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "")}
              >
                {/* Mini preview */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12, height: 40, borderRadius: 8, overflow: "hidden", background: t.sidebar, padding: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: primaryColor, marginTop: 1 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                    <div style={{ height: 3, borderRadius: 2, background: primaryColor, width: "55%", opacity: 0.9 }} />
                    <div style={{ height: 2, borderRadius: 2, background: "#ffffff40", width: "75%" }} />
                    <div style={{ height: 2, borderRadius: 2, background: "#ffffff30", width: "60%" }} />
                  </div>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: active ? primaryColor : "#aaa", marginBottom: 3 }}>
                  {t.name}
                </p>
                <p style={{ fontSize: 11, color: "#666", lineHeight: 1.3 }}>
                  {t.desc}
                </p>
              </button>
            );
          })}
        </div>

        {(saved || error) && (
          <p style={{ marginTop: 14, fontSize: 12, fontWeight: 600, color: error ? "#f87171" : "#34d399" }}>
            {error || "✓ Guardado"}
          </p>
        )}
      </SectionCard>

      {/* ── QR de Reseñas ────────────────────────────────────── */}
      {tenantId && (
        <SectionCard
          title="QR de Reseñas"
          subtitle="Muestra este código a tus clientes para que dejen su opinión directamente desde su teléfono."
          delay={160}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ padding: 12, background: "#fff", borderRadius: 14, flexShrink: 0 }}>
              <QRCodeSVG
                value={`${window.location.origin}/review/${tenantId}`}
                size={130}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Enlace directo
                </p>
                <code style={{
                  display: "block", fontSize: 12, padding: "8px 12px", borderRadius: 8,
                  background: "color-mix(in srgb, var(--color-bg) 60%, var(--color-glass-surface))",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-glass-border)",
                  wordBreak: "break-all",
                }}>
                  {window.location.origin}/review/{tenantId}
                </code>
              </div>
              <button
                onClick={() => {
                  const svg = document.querySelector("#review-qr svg") as SVGElement | null;
                  if (!svg) return;
                  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `qr-resenas-${tenantId}.svg`;
                  a.click();
                }}
                className="btn-primary"
                style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Descargar QR
              </button>
            </div>
          </div>
          <div id="review-qr" style={{ display: "none" }}>
            <QRCodeSVG value={`${window.location.origin}/review/${tenantId}`} size={400} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
        </SectionCard>
      )}

      {/* ── QR de Agendamiento ─────────────────────────────────── */}
      {tenantId && (
        <SectionCard
          title="QR de Agendamiento"
          subtitle="Comparte este código para que tus clientes agenden citas directamente desde su teléfono."
          delay={180}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ padding: 12, background: "#fff", borderRadius: 14, flexShrink: 0 }}>
              <QRCodeSVG
                value={`${window.location.origin}/book/${tenantId}`}
                size={130}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Enlace directo
                </p>
                <code style={{
                  display: "block", fontSize: 12, padding: "8px 12px", borderRadius: 8,
                  background: "color-mix(in srgb, var(--color-bg) 60%, var(--color-glass-surface))",
                  color: "var(--color-text-muted)",
                  border: "1px solid var(--color-glass-border)",
                  wordBreak: "break-all",
                }}>
                  {window.location.origin}/book/{tenantId}
                </code>
              </div>
              <button
                onClick={() => {
                  const svg = document.querySelector("#booking-qr svg") as SVGElement | null;
                  if (!svg) return;
                  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `qr-agendamiento-${tenantId}.svg`;
                  a.click();
                }}
                className="btn-primary"
                style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                Descargar QR
              </button>
            </div>
          </div>
          <div id="booking-qr" style={{ display: "none" }}>
            <QRCodeSVG value={`${window.location.origin}/book/${tenantId}`} size={400} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
        </SectionCard>
      )}

      {/* ── WhatsApp ─────────────────────────────────────────── */}
      <SectionCard
        title="Recordatorios por WhatsApp"
        subtitle="Envía un mensaje automático al cliente 1 hora antes de su cita."
        delay={200}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setWhatsAppEnabled(!whatsAppEnabled)}
              style={{
                position: "relative", width: 44, height: 26, borderRadius: 99, flexShrink: 0,
                background: whatsAppEnabled ? accent : "var(--color-border)",
                transition: "background 200ms ease", cursor: "pointer",
              }}
            >
              <span style={{
                position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                transition: "left 200ms ease",
                left: whatsAppEnabled ? 21 : 3,
              }} />
            </div>
            <span style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600 }}>
              {whatsAppEnabled ? "Activado" : "Desactivado"}
            </span>
          </label>

          <button
            onClick={handleSaveWA}
            disabled={savingWA}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingWA ? 0.6 : 1 }}
          >
            {savingWA ? "Guardando..." : savedWA ? "Guardado" : "Guardar configuración"}
          </button>
        </div>
      </SectionCard>

      {/* ── Festivos colombianos ──────────────────────────────── */}
      <SectionCard
        title="Festivos colombianos"
        subtitle="Los días festivos colombianos no estarán disponibles para agendar citas."
        delay={220}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setHolidaysEnabled(!holidaysEnabled)}
              style={{
                position: "relative", width: 44, height: 26, borderRadius: 99, flexShrink: 0,
                background: holidaysEnabled ? accent : "var(--color-border)",
                transition: "background 200ms ease", cursor: "pointer",
              }}
            >
              <span style={{
                position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                transition: "left 200ms ease",
                left: holidaysEnabled ? 21 : 3,
              }} />
            </div>
            <span style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600 }}>
              {holidaysEnabled ? "Descansar en festivos" : "Trabajar en festivos"}
            </span>
          </label>

          <button
            onClick={async () => {
              setSavingHolidays(true);
              try {
                await brandingService.updateHolidays(holidaysEnabled);
                setSavedHolidays(true);
                setTimeout(() => setSavedHolidays(false), 2000);
              } catch { /* ignore */ }
              finally { setSavingHolidays(false); }
            }}
            disabled={savingHolidays}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingHolidays ? 0.6 : 1 }}
          >
            {savingHolidays ? "Guardando..." : savedHolidays ? "Guardado" : "Guardar configuración"}
          </button>
        </div>
      </SectionCard>

      {/* ── Fidelización ─────────────────────────────────────── */}
      <SectionCard
        title="Programa de fidelización"
        subtitle="Premia a tus clientes frecuentes. Cuando acumulan el número de citas configurado, obtienen una cita gratis."
        delay={240}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* Toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setLoyaltyEnabled(!loyaltyEnabled)}
              style={{
                position: "relative", width: 44, height: 26, borderRadius: 99, flexShrink: 0,
                background: loyaltyEnabled ? accent : "var(--color-border)",
                transition: "background 200ms ease", cursor: "pointer",
              }}
            >
              <span style={{
                position: "absolute", top: 3, width: 20, height: 20, borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                transition: "left 200ms ease",
                left: loyaltyEnabled ? 21 : 3,
              }} />
            </div>
            <span style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600 }}>
              {loyaltyEnabled ? "Activado" : "Desactivado"}
            </span>
          </label>

          {/* Threshold input */}
          <div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Citas necesarias para cita gratis
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min={1}
                max={100}
                value={loyaltyInput}
                onChange={e => {
                  setLoyaltyInput(e.target.value);
                  const n = parseInt(e.target.value);
                  if (!isNaN(n) && n >= 1) setLoyaltyThreshold(n);
                }}
                onBlur={() => {
                  const n = parseInt(loyaltyInput);
                  const safe = isNaN(n) || n < 1 ? 1 : Math.min(n, 100);
                  setLoyaltyThreshold(safe);
                  setLoyaltyInput(String(safe));
                }}
                className="input-theme"
                style={{ width: 90, padding: "9px 12px", borderRadius: 10, fontSize: 14, fontWeight: 700, textAlign: "center" }}
              />
              <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: 0 }}>
                citas completadas = 1 cita gratis
              </p>
            </div>
          </div>

          {/* Reward service selector */}
          <div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Servicio de recompensa
            </p>
            <select
              value={loyaltyRewardServiceId ?? ""}
              onChange={e => setLoyaltyRewardServiceId(e.target.value || null)}
              className="input-theme"
              style={{
                width: "100%", maxWidth: 320, padding: "9px 12px", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                color: loyaltyRewardServiceId ? "var(--color-text)" : "var(--color-text-muted)",
              }}
            >
              <option value="">— Selecciona un servicio —</option>
              {servicesList.map(s => (
                <option key={s.id} value={s.id}>{s.name} — ${s.price.toLocaleString("es-CO")} COP</option>
              ))}
            </select>
            <p style={{ color: "var(--color-text-muted)", fontSize: 11, margin: "6px 0 0", lineHeight: 1.4 }}>
              Solo este servicio podrá ser canjeado como cita gratis. Es obligatorio seleccionar uno para que el programa funcione.
            </p>
          </div>

          <button
            onClick={handleSaveLoyalty}
            disabled={savingLoyalty}
            className="btn-primary"
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: savingLoyalty ? 0.6 : 1 }}
          >
            {savingLoyalty ? "Guardando..." : savedLoyalty ? "Guardado" : "Guardar fidelización"}
          </button>
        </div>
      </SectionCard>

    </div>
  );
};