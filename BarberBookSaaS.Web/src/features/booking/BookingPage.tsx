import React, { useCallback, useEffect, useState } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { bookingService } from "./bookingService";
import { ShadowOverlayBackground } from "../../components/ShadowOverlayBackground";
import { RescheduleModal } from "./RescheduleModal";
import { BarberiaLocationCard } from "./BarberiaLocationCard";
import { useTheme } from "../../context/ThemeContext";
import { publicSuggestionService } from "../suggestions/publicSuggestionService";
import type {
  AvailabilitySlot,
  BookingConfirmation,
  CustomerAppointment,
  CustomerAuth,
  CustomerMe,
  PublicBarber,
  PublicBranding,
  PublicLocation,
  PublicService,
} from "./bookingTypes";

type Step = "landing" | "location" | "service" | "barber" | "datetime" | "confirm" | "done";

const STEP_LABELS_BASE = ["Servicio", "Barbero", "Fecha y hora", "Confirmar"];
const NUMBERED_STEPS_BASE: Step[] = ["service", "barber", "datetime", "confirm"];
const STEP_LABELS_WITH_LOCATION = ["Sede", "Servicio", "Barbero", "Fecha y hora", "Confirmar"];
const NUMBERED_STEPS_WITH_LOCATION: Step[] = ["location", "service", "barber", "datetime", "confirm"];

const localDateStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const today = localDateStr();

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const PHONE_REGEX = /^\+?(?:[\s\-()]*\d){7,15}[\s\-()]*$/;

const STATUS_INFO: Record<string, { bg: string; color: string; border: string }> = {
  Pendiente: { bg: "rgba(245,158,11,0.1)", color: "#D97706", border: "rgba(245,158,11,0.25)" },
  Completada: { bg: "rgba(16,185,129,0.1)", color: "#059669", border: "rgba(16,185,129,0.25)" },
  Cancelada: { bg: "rgba(239,68,68,0.1)", color: "#DC2626", border: "rgba(239,68,68,0.2)" },
};

function readCustomerAuth(subdomain: string): CustomerAuth | null {
  try {
    const raw = localStorage.getItem("customer_user");
    const token = localStorage.getItem("customer_token");
    if (!raw || !token) return null;
    const parsed = JSON.parse(raw);
    if (parsed.tenantId && parsed.tenantId !== subdomain) return null;
    return { ...parsed, token, refreshToken: localStorage.getItem("customer_refresh_token") ?? "" };
  } catch {
    return null;
  }
}

function saveCustomerAuth(auth: CustomerAuth): void {
  localStorage.setItem("customer_token", auth.token);
  localStorage.setItem("customer_refresh_token", auth.refreshToken);
  localStorage.setItem(
    "customer_user",
    JSON.stringify({
      customerId: auth.customerId,
      name: auth.name,
      phone: auth.phone,
      tenantId: auth.tenantId,
      loyaltyCount: auth.loyaltyCount,
    })
  );
}

function clearCustomerAuth(): void {
  localStorage.removeItem("customer_token");
  localStorage.removeItem("customer_refresh_token");
  localStorage.removeItem("customer_user");
}

// ── Generar archivo .ics para agregar cita al calendario ──
function generateIcsFile(opts: {
  title: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  durationMinutes: number;
}): void {
  const { title, description, location, startDate, startTime, durationMinutes } = opts;
  const pad = (n: number) => String(n).padStart(2, "0");
  // Build local datetime string in ICS format: YYYYMMDDTHHMMSS
  const [y, m, d] = startDate.split("-");
  const [hh, mm] = startTime.split(":");
  const start = `${y}${m}${d}T${hh}${mm}00`;
  // Calculate end time
  const startObj = new Date(+y!, +m! - 1, +d!, +hh!, +mm!);
  startObj.setMinutes(startObj.getMinutes() + durationMinutes);
  const end = `${startObj.getFullYear()}${pad(startObj.getMonth() + 1)}${pad(startObj.getDate())}T${pad(startObj.getHours())}${pad(startObj.getMinutes())}00`;
  const uid = `barberbook-${Date.now()}@barberbook.app`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BarberBook//Booking//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de cita",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cita-barberbook.ics";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const BookingPage: React.FC = () => {
  const { subdomain } = useParams<{ subdomain: string }>();
  const sd = (subdomain ?? "").replace(/^\{\{1\}\}/, "").split("?")[0];
  const location = useLocation();
  const isCitasDeepLink = location.pathname.endsWith("/citas");
  const { theme } = useTheme();
  const bgThemeMode = theme === "light-modern" ? "light" : "dark";

  // ── Page data ────────────────────────────────────────────────────────────
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [barbers, setBarbers] = useState<PublicBarber[]>([]);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [suspended, setSuspended] = useState(false);

  // ── Booking flow ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("landing");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<PublicBarber | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [holidays, setHolidays] = useState<string[]>([]);
  const [bookingResult, setBookingResult] = useState<BookingConfirmation | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // ── Customer auth ─────────────────────────────────────────────────────────
  const [customerAuth, setCustomerAuth] = useState<CustomerAuth | null>(() =>
    readCustomerAuth(sd)
  );
  const [searchParams] = useSearchParams();
  const resetTokenParam = searchParams.get("reset_token");

  const [view, setView] = useState<"booking" | "history" | "appointments-login" | "customer-reset">(() => {
    if (resetTokenParam) return "customer-reset";
    if (isCitasDeepLink) {
      return readCustomerAuth(sd) ? "history" : "appointments-login";
    }
    return "booking";
  });
  const [history, setHistory] = useState<CustomerAppointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<CustomerAppointment | null>(null);
  const [suggestionType, setSuggestionType] = useState<"queja" | "sugerencia">("sugerencia");
  const [suggestionMsg, setSuggestionMsg] = useState("");
  const [suggestionSending, setSuggestionSending] = useState(false);
  const [suggestionStatus, setSuggestionStatus] = useState("");

  // ── List interaction (locations, services & barbers) ────────────────────
  const [hoveredLocationIdx, setHoveredLocationIdx] = useState<number | null>(null);
  const [pressedLocationIdx, setPressedLocationIdx] = useState<number | null>(null);
  const [hoveredServiceIdx, setHoveredServiceIdx] = useState<number | null>(null);
  const [pressedServiceIdx, setPressedServiceIdx] = useState<number | null>(null);
  const [hoveredBarberIdx, setHoveredBarberIdx] = useState<number | null>(null);
  const [pressedBarberIdx, setPressedBarberIdx] = useState<number | null>(null);

  // ── Auth form ─────────────────────────────────────────────────────────────
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  // ── Customer reset password ───────────────────────────────────────────────
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [customerMe, setCustomerMe] = useState<CustomerMe | null>(null);

  const primaryColor = branding?.primaryColor ?? "#D4AF37";
  const hasMultipleLocations = locations.length >= 2;
  const selectedLocationAddress = locations.find((l) => l.id === selectedLocationId)?.address;
  const locationCardAddress = selectedLocationAddress ?? branding?.address;

  // ── Load customer loyalty info ────────────────────────────────────────────
  useEffect(() => {
    if (!customerAuth) { setCustomerMe(null); return; }
    bookingService.getCustomerMe()
      .then(setCustomerMe)
      .catch(() => setCustomerMe(null));
  }, [customerAuth]);

  // ── Load page data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sd) return;
    const load = async () => {
      try {
        const [b, sv, ba, hol, locs] = await Promise.all([
          bookingService.getBranding(sd),
          bookingService.getServices(sd),
          bookingService.getBarbers(sd),
          bookingService.getHolidays(sd).catch(() => ({ enabled: false, holidays: [] })),
          bookingService.getLocations(sd).catch(() => []),
        ]);
        setBranding(b);
        setServices(sv);
        setBarbers(ba);
        if (hol.enabled) setHolidays(hol.holidays);
        setLocations(locs);
      } catch (e: unknown) {
        const err = e as { response?: { status?: number } };
        if (err?.response?.status === 503) setSuspended(true);
        else if (err?.response?.status === 404) setNotFound(true);
      } finally {
        setDataLoading(false);
      }
    };
    load();
  }, [sd]);

  // ── Refetch services scoped to the selected sede ──────────────────────────
  useEffect(() => {
    if (!selectedLocationId) return;
    bookingService.getServices(sd, selectedLocationId)
      .then(setServices)
      .catch(() => {});
  }, [selectedLocationId, sd]);

  // ── Refetch barbers scoped to the selected sede ───────────────────────────
  useEffect(() => {
    if (!selectedLocationId) return;
    bookingService.getBarbers(sd, selectedLocationId)
      .then(setBarbers)
      .catch(() => {});
  }, [selectedLocationId, sd]);

  // ── Sync tenant primary color to CSS variable ─────────────────────────────
  useEffect(() => {
    if (branding?.primaryColor) {
      document.documentElement.style.setProperty("--color-primary", branding.primaryColor);
    }
  }, [branding?.primaryColor]);

  // ── Load slots ─────────────────────────────────────────────────────────────
  const isSelectedDateHoliday = holidays.includes(selectedDate);

  useEffect(() => {
    if (!selectedDate || !selectedService || !selectedBarber || isSelectedDateHoliday) {
      setSlots([]);
      return;
    }
    const load = async () => {
      setSlotsLoading(true);
      setSelectedSlot("");
      try {
        const data = await bookingService.getAvailability(
          sd,
          selectedBarber.id,
          selectedService.id,
          selectedDate,
          undefined,
          selectedLocationId ?? undefined
        );
        setSlots(data);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    load();
  }, [selectedDate, selectedService, selectedBarber, sd, isSelectedDateHoliday, selectedLocationId]);

  // ── Load history ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "history" || !customerAuth) return;
    const load = async () => {
      setHistoryLoading(true);
      try {
        const data = await bookingService.getCustomerAppointments();
        setHistory(data);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    load();
  }, [view, customerAuth]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    clearCustomerAuth();
    setCustomerAuth(null);
    setView("booking");
  }, []);

  const handleAuth = async () => {
    if (authTab === "register") {
      if (!authName.trim()) {
        setAuthError("Por favor ingresa tu nombre completo.");
        return;
      }
      if (authPassword.length < 6) {
        setAuthError("La contraseña debe tener mínimo 6 caracteres.");
        return;
      }
      if (!PHONE_REGEX.test(authPhone.trim())) {
        setAuthError("Ingresa un número de teléfono válido (7 a 15 dígitos, con o sin código de país).");
        return;
      }
      if (!acceptedTerms) {
        setAuthError("Debes aceptar los Términos y la Política de Privacidad.");
        return;
      }
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const auth =
        authTab === "login"
          ? await bookingService.loginCustomer(sd, authPhone, authPassword)
          : await bookingService.registerCustomer(sd, authName, authPhone, authPassword);
      saveCustomerAuth(auth);
      setCustomerAuth(auth);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      const status = err?.response?.status;
      if (status === 429) {
        setAuthError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
      } else {
        setAuthError(
          err?.response?.data?.message ??
            (authTab === "login"
              ? "Teléfono o contraseña incorrectos."
              : "No se pudo registrar. Verifica los datos.")
        );
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthForHistory = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const auth = await bookingService.loginCustomer(sd, authPhone, authPassword);
      saveCustomerAuth(auth);
      setCustomerAuth(auth);
      setAuthPhone("");
      setAuthPassword("");
      setView("history");
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 429) {
        setAuthError("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
      } else {
        setAuthError(err?.response?.data?.message ?? "Teléfono o contraseña incorrectos.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSendSuggestion = async () => {
    setSuggestionSending(true);
    setSuggestionStatus("");
    try {
      await publicSuggestionService.create(sd, suggestionType, suggestionMsg.trim());
      setSuggestionMsg("");
      setSuggestionStatus("¡Gracias por tu comentario!");
      setTimeout(() => setSuggestionStatus(""), 4000);
    } catch {
      setSuggestionStatus("Error al enviar. Intenta de nuevo.");
    } finally {
      setSuggestionSending(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    setCancellingId(appointmentId);
    setCancelError("");
    try {
      await bookingService.cancelAppointment(sd, appointmentId);
      const updated = await bookingService.getCustomerAppointments();
      setHistory(updated);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setCancelError(err?.response?.data?.message ?? "No se pudo cancelar la cita.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedBarber || !selectedSlot || !selectedDate) return;
    setBookingLoading(true);
    setBookingError("");
    try {
      const appointmentDate = `${selectedDate}T${selectedSlot}:00`;
      const result = await bookingService.createAppointment(
        sd,
        selectedBarber.id,
        selectedService.id,
        appointmentDate,
        selectedLocationId ?? undefined
      );
      setBookingResult(result);
      setStep("done");
      bookingService.getCustomerMe().then(setCustomerMe).catch(() => {});
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string; errorCode?: string } };
      };
      if (err?.response?.status === 401) {
        // Token expirado o inválido — limpiar sesión para que aparezca el formulario de login
        clearCustomerAuth();
        setCustomerAuth(null);
        setBookingError("Tu sesión expiró. Por favor inicia sesión nuevamente.");
      } else {
        const code = err?.response?.data?.errorCode;
        setBookingError(
          code === "SCHEDULE_CONFLICT"
            ? "Ese horario ya fue reservado. Por favor elige otro."
            : (err?.response?.data?.message ?? "Error al crear la cita. Intenta de nuevo.")
        );
      }
    } finally {
      setBookingLoading(false);
    }
  };

  const resetBooking = () => {
    setStep("landing");
    setSelectedLocationId(null);
    setSelectedService(null);
    setSelectedBarber(null);
    setSelectedDate("");
    setSelectedSlot("");
    setSlots([]);
    setBookingResult(null);
    setBookingError("");
    setAuthError("");
  };

  const STEP_LABELS = hasMultipleLocations ? STEP_LABELS_WITH_LOCATION : STEP_LABELS_BASE;
  const NUMBERED_STEPS = hasMultipleLocations ? NUMBERED_STEPS_WITH_LOCATION : NUMBERED_STEPS_BASE;
  const stepIdx = NUMBERED_STEPS.indexOf(step);

  // ── Loading ───────────────────────────────────────────────────────────────
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
          animation: "booking-spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes booking-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
          El subdominio <strong style={{ color: "var(--color-text)" }}>{sd}</strong> no está registrado en BarberBook.
        </p>
      </div>
    );
  }

  // ── Glass + tilt system ────────────────────────────────────────────────────

  const isDarkTheme = theme !== "light-modern";

  const glassCard: React.CSSProperties = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    boxShadow: isDarkTheme ? "0 4px 20px rgba(0,0,0,0.35)" : "0 2px 12px rgba(0,0,0,0.08)",
  };

  const glassContainer: React.CSSProperties = {
    background: "var(--color-sidebar)",
    border: "1px solid var(--color-border)",
    boxShadow: isDarkTheme ? "0 4px 24px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.07)",
  };

  const tilt = {
    onMouseMove(e: React.MouseEvent<HTMLElement>) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const rotY = ((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 5;
      const rotX = ((e.clientY - r.top - r.height / 2) / (r.height / 2)) * -5;
      el.style.transform = `perspective(700px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(1.015)`;
      el.style.transition = "box-shadow 100ms ease";
      el.style.boxShadow = isDarkTheme
        ? "0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)"
        : "0 12px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)";
    },
    onMouseLeave(e: React.MouseEvent<HTMLElement>) {
      const el = e.currentTarget;
      el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
      el.style.transition = "transform 400ms cubic-bezier(0.23,1,0.32,1), box-shadow 300ms ease";
      el.style.boxShadow = isDarkTheme ? "0 4px 20px rgba(0,0,0,0.35)" : "0 2px 12px rgba(0,0,0,0.08)";
    },
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderAvatar = (label: string, size: "sm" | "lg" = "sm") => {
    const dim = size === "lg" ? 110 : 36;
    const fontSize = size === "lg" ? 36 : 14;
    if (branding?.logoBase64) {
      return (
        <img
          src={branding.logoBase64}
          alt={`Logo de ${branding.name ?? label}`}
          style={{
            width: dim, height: dim,
            borderRadius: size === "lg" ? 20 : "50%",
            objectFit: "contain",
            flexShrink: 0,
          }}
        />
      );
    }
    return (
      <div style={{
        width: dim, height: dim,
        borderRadius: size === "lg" ? 20 : "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: primaryColor, color: "#000",
        fontWeight: 800, fontSize, flexShrink: 0,
      }}>
        {label.charAt(0).toUpperCase()}
      </div>
    );
  };

  const renderStepIndicator = () => (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginBottom: 32 }}>
      {STEP_LABELS.map((label, i) => {
        const canGoBack = i < stepIdx;
        return (
          <React.Fragment key={label}>
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: canGoBack ? "pointer" : "default" }}
              onClick={() => { if (canGoBack) setStep(NUMBERED_STEPS[i]); }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
                background: i <= stepIdx ? primaryColor : "var(--color-glass-surface)",
                border: `1.5px solid ${i <= stepIdx ? primaryColor : "var(--color-glass-border)"}`,
                color: i <= stepIdx ? "#000" : "var(--color-text-muted)",
                transition: "all 200ms ease",
              }}>
                {i < stepIdx ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : String(i + 1)}
              </div>
              <span style={{
                fontSize: 10, fontWeight: i === stepIdx ? 600 : 400,
                whiteSpace: "nowrap",
                color: i === stepIdx ? "var(--color-text)" : "var(--color-text-muted)",
                textDecoration: canGoBack ? "none" : "none",
              }}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{
                height: 1.5, width: 24, marginTop: 13, flexShrink: 0,
                background: i < stepIdx ? primaryColor : "var(--color-glass-border)",
                transition: "background 300ms ease",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderBackBtn = (target: Step) => (
    <button
      onClick={() => setStep(target)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "none", border: "none", cursor: "pointer",
        fontSize: 13, color: "var(--color-text-muted)",
        padding: "0 0 16px", transition: "color 150ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Volver
    </button>
  );

  // ── Landing ────────────────────────────────────────────────────────────────

  const renderLanding = () => (
    <div className="fade-up" style={{ textAlign: "center", padding: "48px 0 40px" }}>
      {/* Logo / Avatar with accent ring */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{
          padding: 4,
          borderRadius: branding?.logoBase64 ? 24 : "50%",
          border: `2px solid color-mix(in srgb, ${primaryColor} 40%, transparent)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${primaryColor} 15%, transparent)`,
        }}>
          {renderAvatar(branding?.name ?? sd, "lg")}
        </div>
      </div>

      {/* Name */}
      <h1 style={{
        fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
        fontWeight: 800, letterSpacing: "-0.03em",
        color: "var(--color-text)", lineHeight: 1.1,
        marginBottom: 8, textWrap: "balance",
      } as React.CSSProperties}>
        {branding?.name ?? sd}
      </h1>

      {/* Address */}
      {branding?.address && (
        <p style={{
          fontSize: 15, color: "var(--color-text-muted)",
          marginBottom: 0, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          {branding.address}
        </p>
      )}

      {/* Divider */}
      <div style={{
        height: 1, background: "var(--color-glass-border)",
        maxWidth: 300, margin: "24px auto",
      }} />

      {/* Services chips */}
      {services.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          <p style={{
            fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--color-text-muted)", marginBottom: 14, fontWeight: 600,
          }}>
            Servicios disponibles
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {services.slice(0, 6).map((s) => (
              <span key={s.id} style={{
                padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
              }}>
                {s.name}
              </span>
            ))}
            {services.length > 6 && (
              <span style={{
                padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 500,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
              }}>
                +{services.length - 6} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* Loyalty progress */}
      {customerMe?.loyaltyEnabled && customerMe.loyaltyRewardServiceName && (
        <div style={{
          maxWidth: 320, margin: "0 auto 16px",
          borderRadius: 12, padding: "14px 18px",
          background: `color-mix(in srgb, ${primaryColor} 6%, var(--color-glass-surface))`,
          border: `1px solid color-mix(in srgb, ${primaryColor} 18%, transparent)`,
          textAlign: "left",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16 }}>&#11088;</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
              Programa de fidelidad
            </span>
          </div>
          {customerMe.loyaltyCount >= customerMe.loyaltyThreshold ? (
            <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", margin: 0 }}>
              &iexcl;Tu pr&oacute;ximo <strong>{customerMe.loyaltyRewardServiceName}</strong> es GRATIS!
            </p>
          ) : (
            <>
              <div style={{
                height: 6, borderRadius: 3,
                background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
                overflow: "hidden", marginBottom: 6,
              }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: primaryColor,
                  width: `${Math.round((customerMe.loyaltyCount / customerMe.loyaltyThreshold) * 100)}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                <strong style={{ color: "var(--color-text)" }}>{customerMe.loyaltyCount}/{customerMe.loyaltyThreshold}</strong>
                {" "}&mdash; {customerMe.loyaltyThreshold - customerMe.loyaltyCount === 1 ? "falta" : "faltan"}{" "}
                <strong>{customerMe.loyaltyThreshold - customerMe.loyaltyCount}</strong>
                {" "}cita{customerMe.loyaltyThreshold - customerMe.loyaltyCount !== 1 ? "s" : ""} para tu <strong>{customerMe.loyaltyRewardServiceName}</strong> gratis
              </p>
            </>
          )}
        </div>
      )}

      {/* CTAs */}
      <div style={{ maxWidth: 320, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => setStep(hasMultipleLocations ? "location" : "service")}
          className="btn-primary"
          style={{
            width: "100%", padding: "14px 24px",
            borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: "pointer", border: "none",
          }}
        >
          Reservar cita
        </button>
        <button
          onClick={() => setView(customerAuth ? "history" : "appointments-login")}
          className="btn-ghost"
          style={{
            width: "100%", padding: "11px 24px",
            borderRadius: 10, fontSize: 13, cursor: "pointer",
          }}
        >
          Ver mis citas
        </button>
      </div>

    </div>
  );

  // ── Service selection (Crystal Liquid list) ─────────────────────────────────

  const secondaryColor = branding?.secondaryColor ?? "#6366F1";

  const contrastColor = (hex: string) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.43 ? "#0d0d0d" : "#ffffff";
  };

  const accentContrast = contrastColor(primaryColor);

  const hexToRgba = (hex: string, a: number) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const serviceThumbGradients = [
    `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.60)}, ${hexToRgba(primaryColor, 0.25)})`,
    `linear-gradient(145deg, ${hexToRgba(secondaryColor, 0.58)}, ${hexToRgba(secondaryColor, 0.24)})`,
    `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.46)}, ${hexToRgba(secondaryColor, 0.40)})`,
    `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.40)}, ${hexToRgba(primaryColor, 0.18)})`,
    `linear-gradient(145deg, ${hexToRgba(secondaryColor, 0.48)}, ${hexToRgba(primaryColor, 0.32)})`,
  ];

  // ── Location selection (Crystal Liquid list) ────────────────────────────────

  const renderLocations = () => {
    const selectedLocationIdx = locations.findIndex((l) => l.id === selectedLocationId);

    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column" }}>
        {renderStepIndicator()}
        {renderBackBtn("landing")}

        {/* Section header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
            color: "var(--color-text-muted)", textTransform: "uppercase",
            marginBottom: 10, marginTop: 0, opacity: 0.5,
          }}>
            Reservar cita · Paso 1 de {STEP_LABELS.length}
          </p>
          <h2 style={{
            fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em",
            color: "var(--color-text)", lineHeight: 1.18, margin: 0,
          }}>
            ¿En qué sede<br />te atendemos?
          </h2>
        </div>

        {/* Location list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {locations.map((loc, i) => {
            const isSel = i === selectedLocationIdx;
            const isHov = i === hoveredLocationIdx;
            const isPrs = i === pressedLocationIdx;
            const scale = isPrs ? 0.973 : isHov ? 1.016 : 1;

            const cardBg = isSel
              ? (isDarkTheme ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.97)")
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.90)")
                : (isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)");

            const cardBorder = isSel
              ? primaryColor
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.13)")
                : (isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)");

            const cardShadow = isSel
              ? `0 0 0 1px ${hexToRgba(primaryColor, 0.22)}, 0 8px 36px ${hexToRgba(primaryColor, 0.16)}`
              : isHov
                ? "0 2px 16px rgba(0,0,0,0.18)"
                : "none";

            return (
              <div
                key={loc.id}
                style={{
                  animation: `fadeInUp 0.44s cubic-bezier(.22,1,.36,1) ${80 + i * 72}ms both`,
                }}
              >
                <div
                  onClick={() => { setSelectedLocationId(loc.id); setStep("service"); }}
                  onMouseEnter={() => setHoveredLocationIdx(i)}
                  onMouseLeave={() => { setHoveredLocationIdx(null); setPressedLocationIdx(null); }}
                  onMouseDown={() => setPressedLocationIdx(i)}
                  onMouseUp={() => setPressedLocationIdx(null)}
                  onTouchStart={() => setPressedLocationIdx(i)}
                  onTouchEnd={() => setPressedLocationIdx(null)}
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${cardBorder}`,
                    background: cardBg,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: cardShadow,
                    cursor: "pointer",
                    transform: `scale(${scale})`,
                    transition: "transform 140ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease, border-color 180ms ease, background 180ms ease",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.55)}, ${hexToRgba(secondaryColor, 0.30)})`,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 600, color: "var(--color-text)",
                      lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {loc.name}
                    </div>
                    <div style={{
                      fontSize: 13, color: "var(--color-text-muted)", marginTop: 2,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {loc.address}
                    </div>
                  </div>
                  {isSel && (
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      background: primaryColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.4)}`,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12L10 17L19 7" stroke={accentContrast} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderServices = () => {
    const selectedServiceIdx = services.findIndex((s) => s.id === selectedService?.id);

    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column" }}>
        {renderStepIndicator()}
        {hasMultipleLocations && renderBackBtn("location")}

        {/* Section header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
            color: "var(--color-text-muted)", textTransform: "uppercase",
            marginBottom: 10, marginTop: 0, opacity: 0.5,
          }}>
            Reservar cita · Paso {stepIdx + 1} de {STEP_LABELS.length}
          </p>
          <h2 style={{
            fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em",
            color: "var(--color-text)", lineHeight: 1.18, margin: 0,
          }}>
            ¿Qué servicio<br />necesitas?
          </h2>
        </div>

        {/* Service list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {services.map((service, i) => {
            const isSel = i === selectedServiceIdx;
            const isHov = i === hoveredServiceIdx;
            const isPrs = i === pressedServiceIdx;
            const scale = isPrs ? 0.973 : isHov ? 1.016 : 1;

            const cardBg = isSel
              ? (isDarkTheme ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.97)")
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.90)")
                : (isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)");

            const cardBorder = isSel
              ? primaryColor
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.13)")
                : (isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)");

            const cardShadow = isSel
              ? `0 0 0 1px ${hexToRgba(primaryColor, 0.22)}, 0 8px 36px ${hexToRgba(primaryColor, 0.16)}`
              : isHov
                ? "0 2px 16px rgba(0,0,0,0.18)"
                : "none";

            const thumbGradient = serviceThumbGradients[i % serviceThumbGradients.length];

            return (
              <div
                key={service.id}
                style={{
                  animation: `fadeInUp 0.44s cubic-bezier(.22,1,.36,1) ${80 + i * 72}ms both`,
                }}
              >
                <div
                  onClick={() => { setSelectedService(service); setStep("barber"); }}
                  onMouseEnter={() => setHoveredServiceIdx(i)}
                  onMouseLeave={() => { setHoveredServiceIdx(null); setPressedServiceIdx(null); }}
                  onMouseDown={() => setPressedServiceIdx(i)}
                  onMouseUp={() => setPressedServiceIdx(null)}
                  onTouchStart={() => setPressedServiceIdx(i)}
                  onTouchEnd={() => setPressedServiceIdx(null)}
                  style={{
                    borderRadius: 18, overflow: "hidden",
                    border: `1px solid ${cardBorder}`,
                    background: cardBg,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: cardShadow,
                    cursor: "pointer",
                    transform: `scale(${scale})`,
                    transition: "transform 140ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease, border-color 180ms ease, background 180ms ease",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* Hero image */}
                  <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: thumbGradient }}>
                    {service.imageBase64 ? (
                      <>
                        <img
                          src={service.imageBase64}
                          alt=""
                          aria-hidden="true"
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            filter: "blur(30px) saturate(1.3)",
                            transform: "scale(1.25)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" }} />
                        <img
                          src={service.imageBase64}
                          alt={service.name}
                          style={{
                            position: "relative",
                            width: "100%", height: "100%",
                            objectFit: "contain", display: "block",
                          }}
                        />
                      </>
                    ) : (
                      <div style={{
                        width: "100%", height: "100%",
                        background: thumbGradient,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}>
                          <circle cx="6" cy="7.5" r="2.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
                          <circle cx="6" cy="16.5" r="2.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
                          <path d="M8.5 9.2L19.8 4.4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M8.5 14.8L19.8 19.6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                    {/* Duration badge */}
                    <span style={{
                      position: "absolute", top: 10, right: 10,
                      padding: "4px 10px", borderRadius: 8,
                      fontSize: 11, fontWeight: 600,
                      background: "rgba(0,0,0,0.55)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      color: "#fff",
                    }}>
                      {service.durationMinutes} min
                    </span>
                    {/* Selection check */}
                    {isSel && (
                      <div style={{
                        position: "absolute", top: 10, left: 10,
                        width: 28, height: 28, borderRadius: "50%",
                        background: primaryColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: "popIn 0.28s cubic-bezier(.22,1,.36,1) both",
                        boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.4)}`,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12L10 17L19 7" stroke={accentContrast} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    {/* Bottom gradient overlay */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: "50%",
                      background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                      pointerEvents: "none",
                    }} />
                  </div>

                  {/* Service info bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: "var(--color-text)",
                        lineHeight: 1.25,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {service.name}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 600, flexShrink: 0, marginLeft: 12,
                      color: isSel ? primaryColor : "var(--color-text)",
                      transition: "color 180ms ease",
                    }}>
                      ${service.price.toLocaleString("es-CO")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  // ── Barber selection ───────────────────────────────────────────────────────

  // ── Barber selection (Crystal Liquid list) ──────────────────────────────────

  const renderBarbers = () => {
    const selectedBarberIdx = barbers.findIndex((b) => b.id === selectedBarber?.id);

    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column" }}>
        {renderStepIndicator()}
        {renderBackBtn("service")}

        {/* Section header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{
            fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
            color: "var(--color-text-muted)", textTransform: "uppercase",
            marginBottom: 10, marginTop: 0, opacity: 0.5,
          }}>
            Reservar cita · Paso {stepIdx + 1} de {STEP_LABELS.length}
          </p>
          <h2 style={{
            fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em",
            color: "var(--color-text)", lineHeight: 1.18, margin: 0,
          }}>
            Elige tu<br />barbero
          </h2>
        </div>

        {/* Barber list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {barbers.map((barber, i) => {
            const isSel = i === selectedBarberIdx;
            const isHov = i === hoveredBarberIdx;
            const isPrs = i === pressedBarberIdx;
            const scale = isPrs ? 0.973 : isHov ? 1.016 : 1;

            const cardBg = isSel
              ? (isDarkTheme ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.97)")
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.90)")
                : (isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.70)");

            const cardBorder = isSel
              ? primaryColor
              : isHov
                ? (isDarkTheme ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.13)")
                : (isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)");

            const cardShadow = isSel
              ? `0 0 0 1px ${hexToRgba(primaryColor, 0.22)}, 0 8px 36px ${hexToRgba(primaryColor, 0.16)}`
              : isHov
                ? "0 2px 16px rgba(0,0,0,0.18)"
                : "none";

            const initial = barber.name.charAt(0).toUpperCase();

            return (
              <div
                key={barber.id}
                style={{
                  animation: `fadeInUp 0.44s cubic-bezier(.22,1,.36,1) ${80 + i * 72}ms both`,
                }}
              >
                <div
                  onClick={() => { setSelectedBarber(barber); setStep("datetime"); }}
                  onMouseEnter={() => setHoveredBarberIdx(i)}
                  onMouseLeave={() => { setHoveredBarberIdx(null); setPressedBarberIdx(null); }}
                  onMouseDown={() => setPressedBarberIdx(i)}
                  onMouseUp={() => setPressedBarberIdx(null)}
                  onTouchStart={() => setPressedBarberIdx(i)}
                  onTouchEnd={() => setPressedBarberIdx(null)}
                  style={{
                    borderRadius: 18, overflow: "hidden",
                    border: `1px solid ${cardBorder}`,
                    background: cardBg,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: cardShadow,
                    cursor: "pointer",
                    transform: `scale(${scale})`,
                    transition: "transform 140ms cubic-bezier(.4,0,.2,1), box-shadow 220ms ease, border-color 180ms ease, background 180ms ease",
                    userSelect: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* Hero image */}
                  <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.50)}, ${hexToRgba(secondaryColor, 0.30)})` }}>
                    {barber.imageBase64 ? (
                      <>
                        <img
                          src={barber.imageBase64}
                          alt=""
                          aria-hidden="true"
                          style={{
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            objectFit: "cover",
                            filter: "blur(30px) saturate(1.3)",
                            transform: "scale(1.25)",
                          }}
                        />
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" }} />
                        <img
                          src={barber.imageBase64}
                          alt={barber.name}
                          style={{
                            position: "relative",
                            width: "100%", height: "100%",
                            objectFit: "contain", display: "block",
                          }}
                        />
                      </>
                    ) : (
                      <div style={{
                        width: "100%", height: "100%",
                        background: `linear-gradient(145deg, ${hexToRgba(primaryColor, 0.50)}, ${hexToRgba(secondaryColor, 0.30)})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{
                          fontSize: 48, fontWeight: 800,
                          color: "rgba(255,255,255,0.35)",
                        }}>
                          {initial}
                        </span>
                      </div>
                    )}
                    {/* Selection check */}
                    {isSel && (
                      <div style={{
                        position: "absolute", top: 10, left: 10,
                        width: 28, height: 28, borderRadius: "50%",
                        background: primaryColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        animation: "popIn 0.28s cubic-bezier(.22,1,.36,1) both",
                        boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.4)}`,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M5 12L10 17L19 7" stroke={accentContrast} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    {/* Bottom gradient overlay */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      height: "50%",
                      background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                      pointerEvents: "none",
                    }} />
                  </div>

                  {/* Barber info bar */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px",
                  }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: "var(--color-text)",
                        lineHeight: 1.25,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {barber.name}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 500, flexShrink: 0, marginLeft: 12,
                      color: isSel ? primaryColor : "var(--color-text-muted)",
                      transition: "color 180ms ease",
                    }}>
                      {barber.specialty || "Barbero profesional"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  };

  // ── Date / Time selection ─────────────────────────────────────────────────

  const renderDateTime = () => {
    const dateObj = selectedDate ? new Date(selectedDate + "T12:00:00") : null;
    const dayName = dateObj ? DAY_NAMES[dateObj.getDay()] : "";

    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {renderStepIndicator()}
        {renderBackBtn("barber")}
        <h2 style={{
          fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--color-text)", marginBottom: 0,
        }}>
          Elige fecha y hora
        </h2>

        <div>
          <label style={{
            display: "block", fontSize: 12, fontWeight: 500,
            color: "var(--color-text-muted)", marginBottom: 8,
          }}>
            Fecha
          </label>
          <input
            type="date"
            min={today}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-theme"
            style={{ width: "100%", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
          />
        </div>

        {selectedDate && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 12 }}>
              {slotsLoading ? "Cargando horarios…" : `Horarios disponibles — ${dayName}`}
            </p>
            {slotsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: "2px solid var(--color-glass-border)",
                  borderTopColor: primaryColor,
                  animation: "booking-spin 0.8s linear infinite",
                }} />
              </div>
            ) : isSelectedDateHoliday ? (
              <div style={{ padding: "16px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600, margin: 0 }}>
                  Este día es festivo — la barbería no trabaja.
                </p>
              </div>
            ) : slots.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic" }}>
                No hay horarios disponibles para este día.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedSlot === slot.time;
                  return (
                    <button
                      key={slot.time}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.time)}
                      style={{
                        padding: "9px 4px", borderRadius: 8,
                        fontSize: 13, fontWeight: isSelected ? 600 : 500,
                        cursor: slot.available ? "pointer" : "not-allowed",
                        transition: "all 150ms ease",
                        background: isSelected ? primaryColor : "var(--color-surface)",
                        border: `1.5px solid ${isSelected ? primaryColor : "var(--color-border)"}`,
                        color: isSelected ? "#000" : slot.available ? "var(--color-text)" : "var(--color-text-muted)",
                        opacity: slot.available ? 1 : 0.3,
                      }}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedSlot && (
          <button
            onClick={() => setStep("confirm")}
            className="btn-primary"
            style={{
              width: "100%", padding: "13px", borderRadius: 10,
              fontSize: 14, border: "none", cursor: "pointer",
            }}
          >
            Continuar
          </button>
        )}
      </div>
    );
  };

  // ── Confirm ────────────────────────────────────────────────────────────────

  const renderConfirm = () => {
    const apptDate = new Date(`${selectedDate}T${selectedSlot}:00`);
    const formattedDate = apptDate.toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const summaryRows = [
      { label: "Servicio", value: selectedService?.name },
      { label: "Barbero", value: selectedBarber?.name },
      { label: "Fecha", value: <span style={{ textTransform: "capitalize" }}>{formattedDate}</span> },
      { label: "Hora", value: selectedSlot },
    ];

    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {renderStepIndicator()}
        {renderBackBtn("datetime")}
        <h2 style={{
          fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--color-text)", marginBottom: 0,
        }}>
          Confirmar reserva
        </h2>

        {/* Summary card */}
        <div style={{ borderRadius: 14, overflow: "hidden", ...glassContainer }}>
          {summaryRows.map(({ label, value }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", fontSize: 13,
              borderBottom: "1px solid var(--color-glass-border)",
            }}>
              <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{value}</span>
            </div>
          ))}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              Total
            </span>
            <span style={{ fontWeight: 800, fontSize: 16, color: "var(--color-text)" }}>
              ${selectedService?.price.toLocaleString("es-CO")}
            </span>
          </div>
        </div>

        {/* Customer auth */}
        {customerAuth ? (
          <div style={{
            borderRadius: 10, padding: "12px 16px",
            background: `color-mix(in srgb, ${primaryColor} 8%, var(--color-glass-surface))`,
            border: `1px solid color-mix(in srgb, ${primaryColor} 25%, transparent)`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 2 }}>
              Reservando como {customerAuth.name}
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{customerAuth.phone}</p>
          </div>
        ) : (
          <div style={{ borderRadius: 14, overflow: "hidden", ...glassContainer }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--color-glass-border)" }}>
              {(["login", "register"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setAuthTab(tab); setAuthError(""); }}
                  style={{
                    flex: 1, padding: "12px", fontSize: 13, fontWeight: 500,
                    background: "none", border: "none", cursor: "pointer",
                    transition: "all 150ms ease", marginBottom: -1,
                    borderBottom: authTab === tab ? `2px solid ${primaryColor}` : "2px solid transparent",
                    color: authTab === tab ? primaryColor : "var(--color-text-muted)",
                  }}
                >
                  {tab === "login" ? "Tengo cuenta" : "Crear cuenta"}
                </button>
              ))}
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {authTab === "register" && (
                <input
                  type="text"
                  placeholder="Tu nombre completo"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="input-theme"
                  style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
                />
              )}
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Teléfono"
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                className="input-theme"
                style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
              />
              <input
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="input-theme"
                style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
              />
              {authTab === "register" && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    style={{ marginTop: 2, accentColor: "var(--color-primary)", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                    Autorizo de manera previa, expresa e informada a BarberBook para realizar el tratamiento de mis
                    datos personales de conformidad con su{" "}
                    <a href="/privacy" target="_blank" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Política de Tratamiento de Datos</a>.
                    {" "}Entiendo que mis datos serán utilizados para la gestión de citas, envío de recordatorios vía
                    WhatsApp y acumulación de puntos. Así mismo, autorizo la transferencia internacional de mis datos
                    a proveedores tecnológicos en los Estados Unidos (Meta Platforms Inc. y Google LLC). Conozco que
                    puedo ejercer mis derechos de Habeas Data escribiendo a barberbook46@gmail.com. Acepto los{" "}
                    <a href="/terms" target="_blank" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Términos y Condiciones</a>.
                  </span>
                </label>
              )}
              {authError && (
                <p style={{ fontSize: 12, color: "#ef4444" }}>{authError}</p>
              )}
              <button
                onClick={handleAuth}
                disabled={authLoading || (authTab === "register" && !acceptedTerms)}
                className="btn-primary"
                style={{
                  width: "100%", padding: "10px", borderRadius: 8,
                  fontSize: 13, border: "none", cursor: authLoading || (authTab === "register" && !acceptedTerms) ? "not-allowed" : "pointer",
                  opacity: authTab === "register" && !acceptedTerms ? 0.5 : 1,
                }}
              >
                {authLoading ? "…" : authTab === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>

              {authTab === "login" && !showForgot && (
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "var(--color-text-muted)",
                    padding: "4px 0", transition: "color 150ms ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {authTab === "login" && showForgot && (
                <div style={{
                  paddingTop: 12, display: "flex", flexDirection: "column", gap: 8,
                  borderTop: "1px solid var(--color-glass-border)",
                }}>
                  {forgotDone ? (
                    <p style={{ fontSize: 12, color: "#10b981", textAlign: "center" }}>
                      Si el número está registrado, recibirás un mensaje de WhatsApp con el enlace.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                        Ingresa tu número de teléfono para recibir el enlace por WhatsApp:
                      </p>
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="3001234567"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="input-theme"
                        style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
                      />
                      <button
                        type="button"
                        disabled={forgotLoading}
                        onClick={async () => {
                          if (!forgotEmail.trim()) return;
                          setForgotLoading(true);
                          try {
                            await bookingService.forgotPasswordCustomer(sd, forgotEmail.trim());
                          } finally {
                            setForgotLoading(false);
                            setForgotDone(true);
                          }
                        }}
                        className="btn-primary"
                        style={{
                          width: "100%", padding: "10px", borderRadius: 8,
                          fontSize: 13, border: "none", cursor: "pointer",
                        }}
                      >
                        {forgotLoading ? "Enviando…" : "Enviar por WhatsApp"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowForgot(false); setForgotDone(false); setForgotEmail(""); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 12, color: "var(--color-text-muted)",
                      transition: "color 150ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {bookingError && (
          <div style={{
            borderRadius: 8, padding: "10px 14px", fontSize: 13, textAlign: "center",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
          }}>
            {bookingError}
          </div>
        )}

        <button
          onClick={handleBooking}
          disabled={!customerAuth || bookingLoading}
          className="btn-primary"
          style={{
            width: "100%", padding: "14px", borderRadius: 10,
            fontSize: 15, border: "none",
            cursor: !customerAuth || bookingLoading ? "not-allowed" : "pointer",
          }}
        >
          {bookingLoading ? "Reservando…" : "Confirmar reserva"}
        </button>
      </div>
    );
  };

  // ── Done ───────────────────────────────────────────────────────────────────

  const renderDone = () => {
    if (!bookingResult) return null;
    const [datePart, timePart] = bookingResult.appointmentDate.split("T");
    const apptDate = new Date(datePart + "T12:00:00");
    const formattedDate = apptDate.toLocaleDateString("es-ES", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const time = timePart?.substring(0, 5) ?? "";

    return (
      <div className="fade-up" style={{
        textAlign: "center", padding: "32px 0 16px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {/* Success mark */}
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
          <h2 style={{
            fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.02em",
            color: "var(--color-text)", marginBottom: 4,
          }}>
            Cita reservada
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Nos vemos pronto.</p>
        </div>

        {/* Summary */}
        <div style={{ borderRadius: 14, overflow: "hidden", textAlign: "left", ...glassContainer }}>
          {[
            { label: "Servicio", value: selectedService?.name },
            { label: "Barbero", value: selectedBarber?.name },
            { label: "Fecha", value: <span style={{ textTransform: "capitalize" }}>{formattedDate}</span> },
            { label: "Hora", value: time },
            { label: "Estado", value: bookingResult.status },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 16px", fontSize: 13,
              borderBottom: "1px solid var(--color-glass-border)",
            }}>
              <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{value}</span>
            </div>
          ))}
          {bookingResult.isFree && (
            <div style={{
              padding: "11px 16px",
              background: "rgba(16,185,129,0.08)",
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981" }}>
                Esta cita es gratis gracias a tu fidelidad.
              </p>
            </div>
          )}
        </div>

        {customerAuth && customerMe?.loyaltyEnabled && customerMe.loyaltyRewardServiceName && !bookingResult.isFree && (
          <div style={{
            borderRadius: 8, padding: "12px 16px", textAlign: "left",
            background: `color-mix(in srgb, ${primaryColor} 8%, var(--color-glass-surface))`,
            border: `1px solid color-mix(in srgb, ${primaryColor} 22%, transparent)`,
          }}>
            <div style={{
              height: 5, borderRadius: 3, marginBottom: 8,
              background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: primaryColor,
                width: `${Math.round((bookingResult.loyaltyCount / customerMe.loyaltyThreshold) * 100)}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text)", margin: 0 }}>
              <strong>{bookingResult.loyaltyCount}/{customerMe.loyaltyThreshold}</strong>
              {" "}&mdash; {customerMe.loyaltyThreshold - bookingResult.loyaltyCount === 1 ? "falta" : "faltan"}{" "}
              <strong>{customerMe.loyaltyThreshold - bookingResult.loyaltyCount}</strong>
              {" "}cita{customerMe.loyaltyThreshold - bookingResult.loyaltyCount !== 1 ? "s" : ""} para tu <strong>{customerMe.loyaltyRewardServiceName}</strong> gratis
            </p>
          </div>
        )}

        {/* Add to calendar */}
        <button
          onClick={() => {
            generateIcsFile({
              title: `Cita: ${selectedService?.name ?? "Barbería"}`,
              description: `Barbero: ${selectedBarber?.name ?? ""}\nServicio: ${selectedService?.name ?? ""}\nPrecio: $${selectedService?.price?.toLocaleString("es-CO") ?? ""}`,
              location: branding?.address ?? branding?.name ?? sd,
              startDate: datePart,
              startTime: time,
              durationMinutes: selectedService?.durationMinutes ?? 30,
            });
          }}
          className="btn-ghost"
          style={{
            width: "100%", padding: "12px", borderRadius: 10, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="12" y1="14" x2="12" y2="18" />
            <line x1="10" y1="16" x2="14" y2="16" />
          </svg>
          Agregar al calendario
        </button>

        {locationCardAddress && (
          <BarberiaLocationCard address={locationCardAddress} tenantName={branding?.name ?? sd} />
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={resetBooking}
            className="btn-ghost"
            style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
          >
            Nueva reserva
          </button>
          {customerAuth && (
            <button
              onClick={() => setView("history")}
              className="btn-primary"
              style={{ flex: 1, padding: "12px", borderRadius: 10, fontSize: 13, border: "none", cursor: "pointer" }}
            >
              Mis citas
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Appointments login ─────────────────────────────────────────────────────

  const renderAppointmentsLogin = () => (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <button
        onClick={() => { setView("booking"); setAuthError(""); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: "var(--color-text-muted)",
          padding: 0, transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver
      </button>

      <div>
        <h2 style={{
          fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em",
          color: "var(--color-text)", marginBottom: 6,
        }}>
          Ver mis citas
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Inicia sesión para consultar tu historial de reservas.
        </p>
      </div>

      <div style={{ borderRadius: 14, overflow: "hidden", ...glassContainer }}>
        <div style={{ padding: "14px 16px 0" }}>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            ¿No tienes cuenta?{" "}
            <button
              onClick={() => { setView("booking"); setStep(hasMultipleLocations ? "location" : "service"); }}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: primaryColor,
                textDecoration: "underline", padding: 0,
              }}
            >
              Reserva una cita
            </button>{" "}
            y crea tu cuenta en el último paso.
          </p>
        </div>
        <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Teléfono"
            value={authPhone}
            onChange={(e) => setAuthPhone(e.target.value)}
            className="input-theme"
            style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuthForHistory()}
            className="input-theme"
            style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
          />
          {authError && <p style={{ fontSize: 12, color: "#ef4444" }}>{authError}</p>}
          <button
            onClick={handleAuthForHistory}
            disabled={authLoading}
            className="btn-primary"
            style={{
              width: "100%", padding: "10px", borderRadius: 8,
              fontSize: 13, border: "none", cursor: "pointer",
            }}
          >
            {authLoading ? "…" : "Iniciar sesión"}
          </button>
          <div style={{ textAlign: "center" }}>
            <a
              href={`/forgot-password?subdomain=${sd}&type=customer`}
              style={{ fontSize: 12, color: "var(--color-text-muted)", textDecoration: "underline" }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  // ── History ────────────────────────────────────────────────────────────────

  const renderHistory = () => (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        onClick={() => { setView("booking"); setStep("landing"); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 13, color: "var(--color-text-muted)",
          padding: 0, transition: "color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Volver
      </button>

      <h2 style={{
        fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.02em",
        color: "var(--color-text)", marginBottom: 0,
      }}>
        Mis citas
      </h2>

      {cancelError && (
        <div style={{
          borderRadius: 8, padding: "10px 14px", fontSize: 13,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444",
        }}>
          {cancelError}
        </div>
      )}

      {historyLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2px solid var(--color-glass-border)",
            borderTopColor: primaryColor,
            animation: "booking-spin 0.8s linear infinite",
          }} />
        </div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 16 }}>
            No tienes citas registradas aún.
          </p>
          <button
            onClick={() => setView("booking")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: primaryColor, textDecoration: "underline",
            }}
          >
            Reservar mi primera cita
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((appt) => {
            const [histDatePart, histTimePart] = appt.appointmentDate.split("T");
            const d = new Date(histDatePart + "T12:00:00");
            const label = d.toLocaleDateString("es-ES", { weekday: "short", month: "short", day: "numeric" });
            const t = histTimePart?.substring(0, 5) ?? "";
            const appointmentMs = new Date(histDatePart + "T" + (histTimePart ?? "00:00:00")).getTime();
            const minutesUntil = (appointmentMs - Date.now()) / 60000;
            const canCancel = appt.status === "Pendiente" && minutesUntil > 60;
            const canReschedule = canCancel && !appt.wasRescheduled;
            const tooLateToCancelPending = appt.status === "Pendiente" && minutesUntil <= 60;
            const isCancellingThis = cancellingId === appt.id;
            const statusInfo = STATUS_INFO[appt.status] ?? {
              bg: "var(--color-glass-surface)", color: "var(--color-text-muted)", border: "var(--color-glass-border)",
            };

            return (
              <div
                key={appt.id}
                {...tilt}
                style={{
                  borderRadius: 12, padding: "14px 16px",
                  display: "flex", flexDirection: "column", gap: 10,
                  transition: "all 200ms ease",
                  ...glassCard,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: 14, fontWeight: 600, color: "var(--color-text)",
                      marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {appt.serviceName}
                    </p>
                    <p style={{
                      fontSize: 12, color: "var(--color-text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {appt.barberName} · {label} {t}
                    </p>
                    {appt.isFree && (
                      <span style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 2, display: "block" }}>
                        Gratis
                      </span>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 5,
                    background: statusInfo.bg, color: statusInfo.color,
                    border: `1px solid ${statusInfo.border}`,
                  }}>
                    {appt.status}
                  </span>
                </div>

                {canCancel && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {canReschedule && (
                      <button
                        onClick={() => setRescheduleTarget(appt)}
                        style={{
                          flex: 1, padding: "7px", borderRadius: 7,
                          fontSize: 12, fontWeight: 600, background: "none",
                          border: `1px solid ${primaryColor}66`, color: primaryColor,
                          cursor: "pointer", transition: "all 150ms ease",
                        }}
                      >
                        Reprogramar
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelAppointment(appt.id)}
                      disabled={isCancellingThis}
                      style={{
                        flex: 1, padding: "7px", borderRadius: 7,
                        fontSize: 12, fontWeight: 600, background: "none",
                        border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                        cursor: "pointer", opacity: isCancellingThis ? 0.5 : 1,
                        transition: "all 150ms ease",
                      }}
                    >
                      {isCancellingThis ? "Cancelando…" : "Cancelar cita"}
                    </button>
                  </div>
                )}

                {tooLateToCancelPending && (
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "center" }}>
                    No es posible cancelar con menos de 1 hora de antelación.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Buzón de quejas/sugerencias */}
      <div style={{ marginTop: 24, borderRadius: 14, padding: "20px 18px", ...glassContainer }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
          ¿Tienes algo que decirnos?
        </h3>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14 }}>
          Envía una queja o sugerencia. Tu opinión nos ayuda a mejorar.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {(["sugerencia", "queja"] as const).map(t => (
            <button
              key={t}
              onClick={() => setSuggestionType(t)}
              style={{
                flex: 1, padding: "7px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid", transition: "all 150ms",
                background: suggestionType === t
                  ? (t === "queja" ? "rgba(239,68,68,0.12)" : `color-mix(in srgb, ${primaryColor} 12%, transparent)`)
                  : "transparent",
                borderColor: suggestionType === t
                  ? (t === "queja" ? "rgba(239,68,68,0.3)" : `color-mix(in srgb, ${primaryColor} 30%, transparent)`)
                  : "var(--color-glass-border)",
                color: suggestionType === t
                  ? (t === "queja" ? "#f87171" : primaryColor)
                  : "var(--color-text-muted)",
              }}
            >
              {t === "queja" ? "Queja" : "Sugerencia"}
            </button>
          ))}
        </div>
        <textarea
          value={suggestionMsg}
          onChange={e => setSuggestionMsg(e.target.value)}
          placeholder="Escribe tu mensaje aquí (mín. 10 caracteres)..."
          rows={3}
          className="input-theme"
          style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
        {suggestionStatus && (
          <p style={{ fontSize: 12, marginTop: 6, color: suggestionStatus.startsWith("Error") ? "#ef4444" : "#10b981", fontWeight: 600 }}>
            {suggestionStatus}
          </p>
        )}
        <button
          disabled={suggestionSending || suggestionMsg.trim().length < 10}
          onClick={handleSendSuggestion}
          className="btn-primary"
          style={{
            width: "100%", padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: "none", cursor: suggestionSending || suggestionMsg.trim().length < 10 ? "not-allowed" : "pointer",
            marginTop: 10, opacity: suggestionSending || suggestionMsg.trim().length < 10 ? 0.5 : 1,
          }}
        >
          {suggestionSending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );

  // ── Customer reset password ────────────────────────────────────────────────

  const renderCustomerReset = () => (
    <div style={{ maxWidth: 400, margin: "40px auto 0" }}>
      <div style={{ borderRadius: 16, padding: 28, ...glassContainer }}>
        {resetDone ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 11l5 5 9-9" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>
              Contraseña actualizada
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <a
              href={`/book/${sd}`}
              className="btn-primary"
              style={{ display: "block", textAlign: "center", width: "100%", padding: "11px", borderRadius: 8, fontSize: 13, border: "none", cursor: "pointer", textDecoration: "none" }}
            >
              Volver al agendamiento de citas
            </a>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
              Nueva contraseña
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 20 }}>
              Ingresa tu nueva contraseña para acceder a tu cuenta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {resetError && <p style={{ fontSize: 12, color: "#ef4444" }}>{resetError}</p>}
              <input
                type="password"
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="input-theme"
                style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
              />
              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                className="input-theme"
                style={{ width: "100%", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}
              />
              <button
                disabled={resetLoading || !resetTokenParam}
                onClick={async () => {
                  if (resetPassword.length < 6) { setResetError("Mínimo 6 caracteres."); return; }
                  if (resetPassword !== resetConfirm) { setResetError("Las contraseñas no coinciden."); return; }
                  setResetError("");
                  setResetLoading(true);
                  try {
                    await bookingService.resetPasswordCustomer(sd, resetTokenParam!, resetPassword);
                    setResetDone(true);
                  } catch {
                    setResetError("El enlace es inválido o ha expirado.");
                  } finally {
                    setResetLoading(false);
                  }
                }}
                className="btn-primary"
                style={{ width: "100%", padding: "11px", borderRadius: 8, fontSize: 13, border: "none", cursor: "pointer" }}
              >
                {resetLoading ? "Guardando…" : "Guardar contraseña"}
              </button>
            </div>
          </>
        )}
      </div>
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
      <style>{`
        @keyframes booking-spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 70% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* All page content sits above the background */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>

      {/* Header */}
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
            {renderAvatar(branding?.name ?? sd, "sm")}
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>
              {branding?.name ?? sd}
            </span>
          </div>

          {customerAuth && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={() => setView(view === "history" ? "booking" : "history")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)",
                  transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                {view === "history" ? "← Reservar" : "Mis citas"}
              </button>
              <div style={{ width: 1, height: 14, background: "var(--color-glass-border)" }} />
              <button
                onClick={handleLogout}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "var(--color-text-muted)", transition: "color 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
              >
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px 60px" }}>
        {view === "customer-reset" ? (
          renderCustomerReset()
        ) : view === "history" ? (
          renderHistory()
        ) : view === "appointments-login" ? (
          renderAppointmentsLogin()
        ) : (
          <>
            {step === "landing" && renderLanding()}
            {step === "location" && renderLocations()}
            {step === "service" && renderServices()}
            {step === "barber" && renderBarbers()}
            {step === "datetime" && renderDateTime()}
            {step === "confirm" && renderConfirm()}
            {step === "done" && renderDone()}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: "20px 16px",
        fontSize: 11, color: "var(--color-text-muted)", opacity: 0.5,
      }}>
        Powered by BarberBook
      </footer>
      </div>{/* /content wrapper */}

      {rescheduleTarget && (
        <RescheduleModal
          subdomain={sd}
          appointment={rescheduleTarget}
          primaryColor={primaryColor}
          onClose={() => setRescheduleTarget(null)}
          onRescheduled={async () => {
            const updated = await bookingService.getCustomerAppointments();
            setHistory(updated);
          }}
        />
      )}
    </div>
  );
};