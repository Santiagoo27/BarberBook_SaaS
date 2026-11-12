import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChangePasswordOverlay } from "./ChangePasswordOverlay";
import { useAuth } from "../context/AuthContext";

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  if (user?.mustChangePassword) return <ChangePasswordOverlay />;

  return (
    <div className="flex h-screen bg-theme">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

      <main className="admin-main-content flex-1 min-h-0 overflow-x-hidden overflow-y-auto bg-theme">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
    </div>
  );
};