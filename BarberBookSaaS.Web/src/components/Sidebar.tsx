import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Scissors, Sparkles,
  CalendarDays, Star, Palette, LogOut, Users, X, MessageSquare, MapPin,
} from "lucide-react";
import apiClient from "../api/apiClient";
import { useLocations } from "../hooks/useLocations";

type IconColor = "gold" | "amber" | "violet" | "muted" | "yellow" | "green";

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
  iconColor: IconColor;
  dividerAfter?: boolean;
}

const ICON_STYLES: Record<IconColor, React.CSSProperties> = {
  gold: {
    background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
    boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 40%, transparent)",
    color: "#000",
  },
  amber:  { background: "rgba(245,158,11,0.18)",  border: "1px solid rgba(245,158,11,0.25)",  color: "#f59e0b" },
  violet: {
    background: "color-mix(in srgb, var(--color-secondary) 18%, transparent)",
    border: "1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent)",
    color: "color-mix(in srgb, var(--color-secondary) 80%, white)",
  },
  muted:  { background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)", color: "var(--color-text-muted)" },
  yellow: { background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" },
  green:  { background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" },
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { logout, user, tenantId } = useAuth();
  const { logoBase64, tenantName } = useTheme();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const { hasMultipleLocations } = useLocations();

  useEffect(() => {
    apiClient.get("/api/appointments", { params: { status: "Pendiente", pageSize: 1 } })
      .then((r: { data: { total?: number } }) => setPendingCount(r.data.total ?? 0))
      .catch(() => {});
  }, [location.pathname]);

  // Cierra el sidebar al navegar (solo tiene efecto en celular, donde isOpen puede ser true)
  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const initial = (user?.role ?? "A")[0].toUpperCase();

  const navItems: NavItem[] = [
    { name: "Inicio",      path: "/dashboard",    icon: <LayoutDashboard size={14} />, iconColor: "gold" },
    { name: "Citas",       path: "/appointments", icon: <CalendarDays size={14} />,    badge: pendingCount || undefined, iconColor: "amber" },
    { name: "Barberos",    path: "/barbers",      icon: <Scissors size={14} />,        iconColor: "violet" },
    ...(hasMultipleLocations
      ? [{ name: "Sedes", path: "/locations", icon: <MapPin size={14} />, iconColor: "amber" as IconColor }]
      : []),
    { name: "Clientes",    path: "/customers",    icon: <Users size={14} />,           iconColor: "amber",  dividerAfter: true },
    { name: "Servicios",   path: "/services",     icon: <Sparkles size={14} />,        iconColor: "muted" },
    { name: "Reseñas",     path: "/reviews",      icon: <Star size={14} />,            iconColor: "yellow" },
    { name: "Buzón",       path: "/suggestions",  icon: <MessageSquare size={14} />,   iconColor: "violet" },
    { name: "Mi Barbería", path: "/branding",     icon: <Palette size={14} />,         iconColor: "green" },
  ];

  return (
    <>
      {/* Overlay oscuro — solo celular, cierra el sidebar al tocarlo */}
      <div
        className={`app-sidebar-overlay${isOpen ? " is-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`app-sidebar${isOpen ? " is-open" : ""} h-full flex flex-col shrink-0 overflow-y-auto`}
        style={{
          width: 248,
          background: "var(--color-glass-surface)",
          borderRight: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
      {/* ── Brand header ────────────────────────────────────── */}
      <div
        style={{
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--color-glass-border)",
        }}
      >
        {/* Logo + name */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              background: logoBase64
                ? "var(--color-surface)"
                : "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              boxShadow: logoBase64
                ? "none"
                : "0 4px 14px color-mix(in srgb, var(--color-primary) 45%, transparent)",
            }}
          >
            {logoBase64 ? (
              <img
                src={logoBase64.startsWith("data:") ? logoBase64 : `data:image/png;base64,${logoBase64}`}
                alt="Logo"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <img src="/logo.png" alt="BarberBook" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
          </div>
          <div>
            <span
              style={{
                display: "block",
                color: "var(--color-text)",
                fontSize: "14px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 140,
              }}
            >
              {tenantName || "BarberBook"}
            </span>
            <span
              style={{
                display: "block",
                color: "var(--color-text-muted)",
                fontSize: "10px",
                fontWeight: 500,
                letterSpacing: "0.04em",
                marginTop: "1px",
              }}
            >
              Panel Admin
            </span>
          </div>
          </div>

          {/* Botón cerrar — solo celular, dentro del header para no tapar el logo (Bug 2) */}
          {isOpen && (
            <button
              onClick={onClose}
              aria-label="Cerrar menú"
              className="app-sidebar-close-btn"
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "9px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-glass-surface)",
                border: "1px solid var(--color-glass-border)",
                color: "var(--color-text-muted)",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tenant pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
            borderRadius: "8px",
            padding: "6px 10px",
          }}
        >
          <span
            style={{
              color: "var(--color-primary)",
              fontSize: "11px",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tenantId ?? "panel"}
          </span>
          <span
            className="pulse-dot"
            style={{
              display: "block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#10b981",
              flexShrink: 0,
              marginLeft: 8,
            }}
          />
        </div>
      </div>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <React.Fragment key={item.path}>
                <li>
                  <Link
                    to={item.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "all 160ms ease",
                      ...(isActive ? {
                        background: "linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 16%, transparent), color-mix(in srgb, var(--color-primary) 3%, transparent) 90%)",
                        boxShadow: "inset 3px 0 0 var(--color-primary)",
                        color: "var(--color-primary)",
                        border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
                      } : {
                        color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
                        border: "1px solid transparent",
                      }),
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = "var(--color-glass-surface-hover)";
                        e.currentTarget.style.color = "var(--color-text)";
                        e.currentTarget.style.borderColor = "var(--color-glass-border)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "color-mix(in srgb, var(--color-text) 50%, transparent)";
                        e.currentTarget.style.borderColor = "transparent";
                      }
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        ...ICON_STYLES[item.iconColor],
                      }}
                    >
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <span
                        style={{
                          display: "inline-block",
                          background: "var(--color-primary)",
                          color: "#000",
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "2px 5px",
                          borderRadius: "5px",
                          lineHeight: 1,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
                {item.dividerAfter && (
                  <li
                    aria-hidden
                    style={{
                      height: 1,
                      margin: "6px 4px",
                      background: "var(--color-glass-border)",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {/* ── User card ──────────────────────────────────────── */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--color-glass-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px",
            borderRadius: "12px",
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              flexShrink: 0,
              background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              color: "#000",
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                color: "var(--color-text)",
                fontSize: "12px",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {user?.role ?? "Admin"}
            </p>
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "10px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {tenantId ?? ""}
            </p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{
              flexShrink: 0,
              padding: "6px",
              borderRadius: "8px",
              color: "var(--color-text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 150ms ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
      </aside>
    </>
  );
};