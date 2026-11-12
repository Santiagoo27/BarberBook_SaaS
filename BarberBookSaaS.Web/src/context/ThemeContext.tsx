import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

const THEME_VARS: Record<string, Record<string, string>> = {
  "dark-premium": {
    "--color-bg": "#0a0a0a",
    "--color-sidebar": "#111111",
    "--color-surface": "#1c1c1e",
    "--color-border": "#2a2a2a",
    "--color-text": "#f5f5f5",
    "--color-text-muted": "#8a8a8a",
    "--color-header": "#141414",
    "--color-glass-surface": "rgba(255, 255, 255, 0.025)",
    "--color-glass-border":  "rgba(255, 255, 255, 0.07)",
    "--color-glass-surface-hover": "rgba(255, 255, 255, 0.04)",
  },
  "antigravity": {
    "--color-bg": "#0f0c29",
    "--color-sidebar": "#1a1744",
    "--color-surface": "#1e1b4b",
    "--color-border": "#3730a3",
    "--color-text": "#e0e7ff",
    "--color-text-muted": "#a5b4fc",
    "--color-header": "#160f3b",
    "--color-glass-surface": "rgba(255, 255, 255, 0.035)",
    "--color-glass-border":  "rgba(255, 255, 255, 0.09)",
    "--color-glass-surface-hover": "rgba(255, 255, 255, 0.055)",
  },
  "light-modern": {
    "--color-bg": "#f8fafc",
    "--color-sidebar": "#ffffff",
    "--color-surface": "#ffffff",
    "--color-border": "#e2e8f0",
    "--color-text": "#0f172a",
    "--color-text-muted": "#64748b",
    "--color-header": "#ffffff",
    "--color-glass-surface": "rgba(255, 255, 255, 0.92)",
    "--color-glass-border":  "rgba(0, 0, 0, 0.10)",
    "--color-glass-surface-hover": "rgba(255, 255, 255, 0.98)",
  },
};

const DEFAULTS = {
  theme: "dark-premium",
  primaryColor: "#D4AF37",
  secondaryColor: "#6366F1",
  logoBase64: null as string | null,
  tenantName: null as string | null,
};

const STORAGE_KEY = "barber_branding";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

function applyToDom(theme: string, primary: string, secondary: string) {
  const root = document.documentElement;
  const vars = THEME_VARS[theme] ?? THEME_VARS["dark-premium"];
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  root.style.setProperty("--color-primary", primary);
  root.style.setProperty("--color-secondary", secondary);
}

interface ThemeContextType {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64: string | null;
  tenantName: string | null;
  applyBranding: (theme: string, primary: string, secondary: string, logo?: string | null, name?: string | null) => void;
  clearBranding: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState(loadFromStorage);

  useEffect(() => {
    applyToDom(state.theme, state.primaryColor, state.secondaryColor);
  }, [state]);

  const applyBranding = (theme: string, primary: string, secondary: string, logo?: string | null, name?: string | null) => {
    const next = { theme, primaryColor: primary, secondaryColor: secondary, logoBase64: logo !== undefined ? logo : state.logoBase64, tenantName: name !== undefined ? name : state.tenantName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  };

  const clearBranding = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULTS);
  };

  return (
    <ThemeContext.Provider value={{ ...state, applyBranding, clearBranding }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
