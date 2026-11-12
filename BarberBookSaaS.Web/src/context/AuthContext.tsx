import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authService } from "../features/auth/authService";
import { brandingService } from "../features/branding/brandingService";
import { useTheme } from "./ThemeContext";
import type { LoginRequest } from "../features/auth/authTypes";

interface User {
  id: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginGlobal: (credentials: LoginRequest, subdomain?: string) => Promise<{ role: string; mustChangePassword: boolean }>;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { applyBranding } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("barber_token");
    const savedTenant = localStorage.getItem("barber_tenant_id");
    const savedUser = localStorage.getItem("barber_user");
    if (token && savedTenant !== null && savedUser) {
      setTenantId(savedTenant);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const clearMustChangePassword = () => {
    const stored = localStorage.getItem("barber_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.mustChangePassword = false;
      localStorage.setItem("barber_user", JSON.stringify(parsed));
    }
    setUser((prev) => prev ? { ...prev, mustChangePassword: false } : null);

    // The branding fetch in loginGlobal was blocked with 403 by MustChangePasswordMiddleware
    // (the Barbero still had MustChangePassword=true at that point). Retry it now that the
    // password has been changed and the backend will allow the request through.
    brandingService.getBranding()
      .then((b) => applyBranding(b.theme, b.primaryColor, b.secondaryColor, b.logoBase64 ?? null, b.name ?? null))
      .catch(() => {});
  };

  const loginGlobal = async (credentials: LoginRequest, subdomain?: string) => {
    localStorage.removeItem("barber_token");
    localStorage.removeItem("barber_refresh_token");
    if (subdomain?.trim()) {
      localStorage.setItem("barber_tenant_id", subdomain.trim().toLowerCase());
    } else if (!localStorage.getItem("barber_tenant_id")) {
      try {
        const lookup = await authService.lookupTenantByEmail(credentials.email);
        if (lookup.tenantId) {
          localStorage.setItem("barber_tenant_id", lookup.tenantId);
        }
      } catch {}
    }

    let data;
    try {
      data = await authService.login(credentials);
    } catch (err) {
      localStorage.removeItem("barber_tenant_id");
      throw err;
    }

    const { token, refreshToken, tenantId, userId, role, mustChangePassword } = data;

    localStorage.setItem("barber_token", token);
    localStorage.setItem("barber_refresh_token", refreshToken);
    localStorage.setItem("barber_tenant_id", tenantId);
    localStorage.setItem("barber_user", JSON.stringify({ id: userId, email: data.email, role, mustChangePassword }));

    setTenantId(tenantId);
    setUser({ id: userId, email: data.email, role, mustChangePassword });
    setIsAuthenticated(true);

    brandingService.getBranding()
      .then((b) => applyBranding(b.theme, b.primaryColor, b.secondaryColor, b.logoBase64 ?? null, b.name ?? null))
      .catch(() => {});

    return { role, mustChangePassword: mustChangePassword ?? false };
  };

  const logout = () => {
    ["barber_token", "barber_refresh_token", "barber_user"].forEach(
      (k) => localStorage.removeItem(k)
    );
    setUser(null);
    setTenantId(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, tenantId, isAuthenticated, loading, loginGlobal, logout, clearMustChangePassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return ctx;
};
