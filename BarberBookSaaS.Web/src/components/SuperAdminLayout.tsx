import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Building2, LogOut, Menu, X } from "lucide-react";

export const SuperAdminLayout: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { name: "Barberías", path: "/superadmin", icon: <Building2 size={15} /> },
  ];

  const sidebar = (
    <>
      <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--color-glass-border)" }}>
        <img src="/logo.png" alt="BarberBook" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>BarberBook</p>
          <p style={{ fontSize: 10, color: "var(--color-primary)", margin: 0 }}>Super Admin</p>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "16px 8px" }}>
        <p style={{ padding: "0 8px", marginBottom: 6, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-muted)" }}>
          Gestión global
        </p>
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all 150ms",
                background: isActive ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                borderLeft: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
                color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: 8, borderTop: "1px solid var(--color-glass-border)" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10,
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
        }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: "var(--color-primary)", color: "#000", flexShrink: 0 }}>S</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>SuperAdmin</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, transition: "color 150ms" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: 220, height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column",
        background: "var(--color-sidebar)", borderRight: "1px solid var(--color-glass-border)", flexShrink: 0,
      }} className="superadmin-sidebar-desktop">
        {sidebar}
      </aside>

      {/* Mobile header */}
      <div className="superadmin-mobile-header" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "none", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "var(--color-sidebar)", borderBottom: "1px solid var(--color-glass-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="BarberBook" style={{ width: 30, height: 30, objectFit: "contain" }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--color-text)" }}>BarberBook</span>
          <span style={{ fontSize: 10, color: "var(--color-primary)", fontWeight: 600 }}>Admin</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text)", padding: 4 }}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99, background: "rgba(0,0,0,0.6)" }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            style={{
              position: "absolute", top: 56, left: 0, bottom: 0, width: 260,
              background: "var(--color-sidebar)", borderRight: "1px solid var(--color-glass-border)",
              display: "flex", flexDirection: "column", overflowY: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      <main className="superadmin-main" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24 }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .superadmin-sidebar-desktop { display: none !important; }
          .superadmin-mobile-header { display: flex !important; }
          .superadmin-main { padding: 72px 16px 24px !important; }
        }
      `}</style>
    </div>
  );
};
