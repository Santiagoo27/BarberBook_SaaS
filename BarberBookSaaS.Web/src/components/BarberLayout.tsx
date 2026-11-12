import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { barberService } from "../features/barbers/barberService";
import { ChangePasswordOverlay } from "./ChangePasswordOverlay";
import { CalendarDays, Clock, LogOut, Menu, X } from "lucide-react";

/* ── BarberLayout ───────────────────────────────────────────── */
export const BarberLayout: React.FC = () => {
  const { logout, user, tenantId } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [barberName, setBarberName] = useState<string | null>(null);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user?.role === "Barbero") {
      barberService.getMe()
        .then(b => setBarberName(b.name))
        .catch(() => {});
    }
  }, [user?.role]);

  if (user?.mustChangePassword) return <ChangePasswordOverlay />;

  const displayName = barberName ?? user?.email ?? "Barbero";
  const initial = displayName[0].toUpperCase();

  const navItems = [
    {
      name: "Mis Citas",
      path: "/barber",
      icon: <CalendarDays size={14} />,
      iconStyle: {
        background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
        boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 40%, transparent)",
        color: "#000",
      } as React.CSSProperties,
    },
    {
      name: "Mi Horario",
      path: "/barber/schedule",
      icon: <Clock size={14} />,
      iconStyle: {
        background: "rgba(245,158,11,0.18)",
        border: "1px solid rgba(245,158,11,0.25)",
        color: "#f59e0b",
      } as React.CSSProperties,
    },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--color-bg)" }}>

      {/* Overlay oscuro — solo celular, cierra el sidebar al tocarlo */}
      <div
        className={`app-sidebar-overlay${sidebarOpen ? " is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Botón hamburguesa — solo celular; se oculta con el drawer abierto para no tapar el logo (Bug 2) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Abrir menú"
          className="app-sidebar-trigger"
          style={{
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
            color: "var(--color-text)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <Menu size={18} />
        </button>
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={`app-sidebar${sidebarOpen ? " is-open" : ""}`} style={{
        width: 248,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
        background: "var(--color-glass-surface)",
        borderRight: "1px solid var(--color-glass-border)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}>

        {/* ── Brand header ──────────────────────────────────── */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--color-glass-border)" }}>
          {/* Logo + name */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <img src="/logo.png" alt="BarberBook" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
              <div>
                <span style={{
                  display: "block", color: "var(--color-text)",
                  fontSize: 14, fontWeight: 800,
                  letterSpacing: "-0.02em", lineHeight: 1.1,
                }}>
                  BarberBook
                </span>
                <span style={{
                  display: "block", color: "var(--color-text-muted)",
                  fontSize: 10, fontWeight: 500,
                  letterSpacing: "0.04em", marginTop: 1,
                }}>
                  Panel Barbero
                </span>
              </div>
            </div>

            {/* Botón cerrar — solo celular, dentro del header para no tapar el logo (Bug 2) */}
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
                className="app-sidebar-close-btn"
                style={{
                  flexShrink: 0,
                  width: 32, height: 32, borderRadius: 9,
                  display: "flex", alignItems: "center", justifyContent: "center",
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
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
            borderRadius: 8, padding: "6px 10px",
          }}>
            <span style={{
              color: "var(--color-primary)", fontSize: 11, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {tenantId ?? "panel"}
            </span>
            <span
              className="pulse-dot"
              style={{
                display: "block", width: 7, height: 7, borderRadius: "50%",
                background: "#10b981", flexShrink: 0, marginLeft: 8,
              }}
            />
          </div>
        </div>

        {/* ── Nav ───────────────────────────────────────────── */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      fontSize: 13, fontWeight: 500, textDecoration: "none",
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
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      ...item.iconStyle,
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── User card ─────────────────────────────────────── */}
        <div style={{ padding: 12, borderTop: "1px solid var(--color-glass-border)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: 10,
            borderRadius: 12,
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              color: "#000",
            }}>
              {initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{
                color: "var(--color-text)", fontSize: 12, fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                lineHeight: 1.3, margin: 0,
              }}>
                {displayName}
              </p>
              <p style={{
                color: "var(--color-text-muted)", fontSize: 10,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                lineHeight: 1.4, margin: 0,
              }}>
                {tenantId ?? ""}
              </p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              style={{
                flexShrink: 0, padding: 6, borderRadius: 8,
                color: "var(--color-text-muted)", background: "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.background = "transparent"; }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="barber-main-content" style={{
        flex: 1, minHeight: 0,
        overflowX: "hidden", overflowY: "auto",
        background: "var(--color-bg)",
      }}>
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
};