# Premium UI Redesign — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actualizar el frontend de BarberBook SaaS a estética Raycast/Glassmorphism: fuente Inter local, sidebar con íconos de color, stat cards semitransparentes, contenedores glass, botones con gradiente y glow, modales glass — resultado idéntico a los mockups aprobados, sin tocar lógica de negocio, rutas ni APIs.

**Architecture:** Cambios puramente visuales a componentes React y CSS. Nuevas variables CSS (`--color-glass-surface`, `--color-glass-border`, `--color-glass-surface-hover`) en ThemeContext propagadas a los 3 temas. Inter servido via `@fontsource/inter` (Vite lo bundlea — sin CDN). Todos los colores de acento usan `color-mix()` contra `--color-primary`/`--color-secondary` para que el branding del negocio adapte automáticamente.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Vite, @fontsource/inter

**Spec:** `docs/superpowers/specs/2026-06-04-premium-ui-redesign.md`

---

## Mapa de archivos

| Archivo | Cambio |
|---------|--------|
| `BarberBookSaaS.Web/package.json` | Agregar `@fontsource/inter` |
| `src/index.css` | Quitar Google Fonts; agregar @fontsource imports; clases glass/stat-card-*/tenant-pill; actualizar nav-item-active/inactive |
| `src/context/ThemeContext.tsx` | Agregar 3 variables glass a cada tema |
| `src/index.css` (botones) | `btn-primary` gradiente + glow; nueva clase `.btn-ghost` glass |
| `src/components/Sidebar.tsx` | Tenant pill, íconos de color, fondo glass, sin labels de sección |
| `src/components/BarberLayout.tsx` | Mismo tratamiento glass para sidebar del barbero |
| `src/features/dashboard/Dashboard.tsx` | Stat cards con variantes, SectionCard glass, título Inter 800 |
| `src/features/auth/Login.tsx` | Card glass, título Inter extrabold, fondo adaptable a temas |
| `src/features/appointments/AppointmentManagement.tsx` | Glass, paleta de avatares, badge más grande, título Inter |
| `src/features/barbers/BarberManagement.tsx` | Glass, paleta de avatares, título Inter |
| `src/features/booking/BookingPage.tsx` | Glass en contenedores de cada paso |
| `src/features/services/ServiceManagement.tsx` | Glass + título Inter |
| `src/features/reviews/AdminReviews.tsx` | Glass + título Inter |
| `src/features/branding/BrandingPage.tsx` | Glass + título Inter |
| `src/features/barbers/BarberSchedule.tsx` | Glass + título Inter |

---

## Tarea 1: Instalar Inter y actualizar tipografía CSS

**Archivos:**
- Modificar: `BarberBookSaaS.Web/package.json`
- Modificar: `BarberBookSaaS.Web/src/index.css`

- [ ] **Paso 1.1 — Instalar @fontsource/inter**

```bash
cd BarberBookSaaS.Web
npm install @fontsource/inter
```

- [ ] **Paso 1.2 — Reemplazar Google Fonts por @fontsource en index.css**

Abrir `src/index.css`. Reemplazar la primera línea completa:

```css
/* ELIMINAR esta línea: */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

/* PONER esto en su lugar (antes de @tailwind base): */
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/inter/800.css';
```

- [ ] **Paso 1.3 — Actualizar font-family en body**

En el bloque `body {}` de `index.css`, cambiar la línea `font-family`:

```css
body {
  background-color: var(--color-bg, #0a0a0a);
  color: var(--color-text, #f5f5f5);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  margin: 0;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Paso 1.4 — Eliminar la clase .font-display**

Eliminar este bloque entero de `@layer utilities`:

```css
/* ELIMINAR: */
.font-display {
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
}
```

- [ ] **Paso 1.5 — Actualizar nav-item-active e nav-item-inactive**

Reemplazar los dos bloques actuales (que usan `border-left`) con:

```css
/* ── Navigation items ────────────────────────────────── */
.nav-item-active {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-primary) 14%, transparent),
    color-mix(in srgb, var(--color-primary) 3%, transparent) 90%
  );
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  color: var(--color-primary);
}
.nav-item-inactive {
  color: color-mix(in srgb, var(--color-text) 42%, transparent);
  border: 1px solid transparent;
  transition: all 150ms ease;
}
.nav-item-inactive:hover {
  background: var(--color-glass-surface-hover, rgba(255,255,255,0.04));
  color: var(--color-text);
  border-color: var(--color-glass-border, rgba(255,255,255,0.07));
}
```

- [ ] **Paso 1.6 — Verificar build**

```bash
cd BarberBookSaaS.Web
npm run build
```

Esperado: sin errores. Si `font-display` se sigue usando en algún archivo, eliminar la clase de ese archivo antes de continuar.

- [ ] **Paso 1.7 — Commit**

```bash
git add BarberBookSaaS.Web/package.json BarberBookSaaS.Web/package-lock.json BarberBookSaaS.Web/src/index.css
git commit -m "feat: reemplazar Google Fonts CDN por Inter local via @fontsource"
```

---

## Tarea 2: Variables glassmorphism en ThemeContext y clases CSS

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/context/ThemeContext.tsx`
- Modificar: `BarberBookSaaS.Web/src/index.css`

- [ ] **Paso 2.1 — Agregar variables glass a los 3 temas en ThemeContext.tsx**

En `THEME_VARS`, agregar 3 claves a cada tema:

```ts
const THEME_VARS: Record<string, Record<string, string>> = {
  "dark-premium": {
    "--color-bg": "#0a0a0a",
    "--color-sidebar": "#111111",
    "--color-surface": "#1c1c1e",
    "--color-border": "#2a2a2a",
    "--color-text": "#f5f5f5",
    "--color-text-muted": "#8a8a8a",
    "--color-header": "#141414",
    // NUEVAS:
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
    // NUEVAS:
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
    // NUEVAS (invertidas para tema claro):
    "--color-glass-surface": "rgba(0, 0, 0, 0.025)",
    "--color-glass-border":  "rgba(0, 0, 0, 0.07)",
    "--color-glass-surface-hover": "rgba(0, 0, 0, 0.04)",
  },
};
```

- [ ] **Paso 2.2 — Agregar clases utilitarias a index.css**

Agregar dentro de `@layer utilities { }`, al final del bloque existente:

```css
/* ── Glass ───────────────────────────────────────── */
.glass {
  background: var(--color-glass-surface);
  border: 1px solid var(--color-glass-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* ── Stat card por variante ───────────────────────── */
.stat-card-primary {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
}
.stat-card-amber {
  background: rgba(245, 158, 11, 0.09);
  border: 1px solid rgba(245, 158, 11, 0.22);
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.06);
}
.stat-card-violet {
  background: color-mix(in srgb, var(--color-secondary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent);
}
.stat-card-green {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.18);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.05);
}

/* ── Tenant pill ──────────────────────────────────── */
.tenant-pill {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-radius: 7px;
  padding: 5px 10px;
}
```

- [ ] **Paso 2.3 — Actualizar `btn-primary` con gradiente y glow**

En `index.css`, reemplazar el bloque `.btn-primary` completo:

```css
/* ── Primary button ──────────────────────────────────── */
.btn-primary {
  background: linear-gradient(
    135deg,
    var(--color-primary),
    color-mix(in srgb, var(--color-primary) 72%, #000)
  );
  color: #000;
  font-weight: 600;
  border: none;
  transition: filter 150ms ease, transform 150ms ease, box-shadow 150ms ease;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--color-primary) 45%, transparent);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: none;
  filter: none;
}
.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  filter: none;
}
```

- [ ] **Paso 2.4 — Agregar clase `.btn-ghost` para botones secundarios**

Añadir después del bloque `.btn-primary` en `index.css`:

```css
/* ── Ghost button (secundario) ───────────────────────── */
.btn-ghost {
  background: var(--color-glass-surface);
  border: 1px solid var(--color-glass-border);
  color: var(--color-text-muted);
  font-weight: 500;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 150ms ease;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--color-glass-surface-hover);
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-text);
}
.btn-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Paso 2.5 — Verificar build**

```bash
cd BarberBookSaaS.Web && npm run build
```

Esperado: sin errores TypeScript.

- [ ] **Paso 2.6 — Commit**

```bash
git add BarberBookSaaS.Web/src/context/ThemeContext.tsx BarberBookSaaS.Web/src/index.css
git commit -m "feat: variables glass, stat-card variants, btn-primary gradiente, btn-ghost"
```

---

## Tarea 3: Rediseño Sidebar.tsx

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/components/Sidebar.tsx`

- [ ] **Paso 3.1 — Reemplazar Sidebar.tsx completo**

Reemplazar todo el contenido del archivo con:

```tsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Scissors, Sparkles,
  CalendarDays, Star, Palette, LogOut,
} from "lucide-react";
import { appointmentService } from "../features/appointments/appointmentService";

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
  gold:   {
    background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
    boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 40%, transparent)",
  },
  amber:  { background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.25)" },
  violet: {
    background: "color-mix(in srgb, var(--color-secondary) 18%, transparent)",
    border: "1px solid color-mix(in srgb, var(--color-secondary) 28%, transparent)",
  },
  muted:  { background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)" },
  yellow: { background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.2)" },
  green:  { background: "rgba(16,185,129,0.18)", border: "1px solid rgba(16,185,129,0.25)" },
};

export const Sidebar: React.FC = () => {
  const { logout, user, tenantId } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    appointmentService.getAll().then((appts) => {
      setPendingCount(appts.filter((a) => a.status === "Pendiente").length);
    }).catch(() => {});
  }, []);

  const initial = (user?.role ?? "A")[0].toUpperCase();

  const navItems: NavItem[] = [
    { name: "Inicio",      path: "/dashboard",    icon: <LayoutDashboard size={13} />, iconColor: "gold" },
    { name: "Citas",       path: "/appointments", icon: <CalendarDays size={13} />,    badge: pendingCount || undefined, iconColor: "amber" },
    { name: "Barberos",    path: "/barbers",      icon: <Scissors size={13} />,        iconColor: "violet", dividerAfter: true },
    { name: "Servicios",   path: "/services",     icon: <Sparkles size={13} />,        iconColor: "muted" },
    { name: "Reseñas",     path: "/reviews",      icon: <Star size={13} />,            iconColor: "yellow" },
    { name: "Mi Barbería", path: "/branding",     icon: <Palette size={13} />,         iconColor: "green" },
  ];

  return (
    <aside
      className="w-56 h-full flex flex-col shrink-0 overflow-y-auto"
      style={{
        background: "var(--color-glass-surface)",
        borderRight: "1px solid var(--color-glass-border)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* ── Logo + tenant pill ──────────────────────── */}
      <div
        className="px-3 pt-4 pb-3"
        style={{ borderBottom: "1px solid var(--color-glass-border)" }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)",
            }}
          >
            <Scissors size={13} color="#000" strokeWidth={2.5} />
          </div>
          <span
            className="text-[13px] font-bold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            BarberBook
          </span>
        </div>
        <div className="tenant-pill flex items-center justify-between">
          <span
            className="text-[11px] font-semibold truncate"
            style={{ color: "var(--color-primary)" }}
          >
            {tenantId ?? "panel"}
          </span>
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0 ml-2"
            style={{ background: "#10b981", boxShadow: "0 0 7px rgba(16,185,129,0.8)" }}
          />
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <React.Fragment key={item.path}>
                <li>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all ${
                      isActive ? "nav-item-active" : "nav-item-inactive"
                    }`}
                  >
                    <span
                      className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
                      style={ICON_STYLES[item.iconColor]}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.name}</span>
                    {item.badge && item.badge > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[6px] badge-primary leading-none">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
                {item.dividerAfter && (
                  <li
                    aria-hidden
                    className="h-px mx-1 my-1.5"
                    style={{ background: "var(--color-glass-border)" }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {/* ── User card ───────────────────────────────────── */}
      <div
        className="p-2.5"
        style={{ borderTop: "1px solid var(--color-glass-border)" }}
      >
        <div
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
          style={{
            background: "var(--color-glass-surface)",
            border: "1px solid var(--color-glass-border)",
          }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              color: "#000",
            }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[12px] font-semibold truncate leading-tight"
              style={{ color: "var(--color-text)" }}
            >
              {user?.role ?? "Admin"}
            </p>
            <p
              className="text-[10px] truncate leading-tight"
              style={{ color: "var(--color-text-muted)" }}
            >
              {tenantId ?? ""}
            </p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="shrink-0 p-1.5 rounded-md transition-all"
            style={{ color: "var(--color-text-muted)", background: "transparent" }}
            onMouseEnter={e => {
              e.currentTarget.style.color = "#f87171";
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
};
```

- [ ] **Paso 3.2 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Luego `npm run dev` y abrir http://localhost:5173/dashboard. Verificar:
- Sidebar muestra fondo glass (semitransparente)
- Tenant pill visible en color primary con punto verde
- Íconos tienen fondos de color (dorado, ámbar, violeta, neutro, amarillo, verde)
- Ítem activo muestra borde + texto en primary color
- No hay labels de sección "Principal"/"Gestión"

- [ ] **Paso 3.3 — Commit**

```bash
git add BarberBookSaaS.Web/src/components/Sidebar.tsx
git commit -m "feat: rediseño Sidebar con glassmorphism e íconos de color"
```

---

## Tarea 4: Rediseño Dashboard.tsx

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/dashboard/Dashboard.tsx`

- [ ] **Paso 4.1 — Reemplazar la interfaz StatCardProps y el componente StatCard**

Eliminar los imports de `TrendingUp` si existe. Reemplazar `StatCardProps` y `StatCard`:

```tsx
type StatVariant = "primary" | "amber" | "violet" | "green";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  variant?: StatVariant;
}

const VARIANT_STYLES: Record<StatVariant, {
  card: string;
  labelColor: string;
  valueColor: string;
  iconBg: string;
  iconColor: string;
}> = {
  primary: {
    card: "stat-card-primary",
    labelColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
    valueColor: "var(--color-text)",
    iconBg: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
    iconColor: "var(--color-primary)",
  },
  amber: {
    card: "stat-card-amber",
    labelColor: "rgba(245,158,11,0.75)",
    valueColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.2)",
    iconColor: "#f59e0b",
  },
  violet: {
    card: "stat-card-violet",
    labelColor: "color-mix(in srgb, var(--color-secondary) 70%, transparent)",
    valueColor: "var(--color-text)",
    iconBg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
    iconColor: "color-mix(in srgb, var(--color-secondary) 80%, white)",
  },
  green: {
    card: "stat-card-green",
    labelColor: "rgba(16,185,129,0.75)",
    valueColor: "var(--color-text)",
    iconBg: "rgba(16,185,129,0.2)",
    iconColor: "#34d399",
  },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, variant = "primary" }) => {
  const v = VARIANT_STYLES[variant];
  return (
    <div className={`rounded-xl p-5 flex flex-col gap-3 ${v.card}`}>
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: v.iconBg, color: v.iconColor }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: v.labelColor }}
        >
          {label}
        </p>
        <p
          className="text-[28px] font-extrabold leading-none"
          style={{
            color: v.valueColor,
            letterSpacing: "-0.04em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--color-text-muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Paso 4.2 — Actualizar los 4 usos de StatCard con la prop `variant`**

Reemplazar el bloque de 4 stat cards en el JSX del componente:

```tsx
<StatCard
  label="Citas de Hoy"
  value={todayAll.length}
  icon={<CalendarDays size={17} />}
  sub={`${todayComplete.length} complet. · ${todayPending.length} pend.`}
  variant="primary"
/>
<StatCard
  label="Pendientes"
  value={todayPending.length}
  icon={<Clock size={17} />}
  sub="Por atender hoy"
  variant="amber"
/>
<StatCard
  label="Barberos Activos"
  value={barbers.length}
  icon={<Users size={17} />}
  sub={barbers.length === 1 ? "profesional" : "profesionales"}
  variant="violet"
/>
<StatCard
  label="Ingresos Hoy"
  value={`$${revenueToday.toLocaleString("es-CO")}`}
  icon={<DollarSign size={17} />}
  sub={revenuePend > 0 ? `+ $${revenuePend.toLocaleString("es-CO")} potencial` : "confirmados"}
  variant="green"
/>
```

Eliminar `TrendingUp` del import de lucide-react si aparece.

- [ ] **Paso 4.3 — Actualizar SectionCard a glass**

Reemplazar el componente `SectionCard`:

```tsx
const SectionCard: React.FC<{
  title: string;
  count?: number;
  children: React.ReactNode;
  right?: React.ReactNode;
}> = ({ title, count, children, right }) => (
  <div
    className="rounded-xl overflow-hidden"
    style={{
      background: "var(--color-glass-surface)",
      border: "1px solid var(--color-glass-border)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}
  >
    <div
      className="px-5 py-3.5 flex items-center justify-between gap-4"
      style={{ borderBottom: "1px solid var(--color-glass-border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-[3px] h-4 rounded-full"
          style={{ background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))" }}
        />
        <h2 className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
          {title}
          {count !== undefined && (
            <span className="ml-2 font-normal" style={{ color: "var(--color-text-muted)" }}>
              ({count})
            </span>
          )}
        </h2>
      </div>
      {right}
    </div>
    {children}
  </div>
);
```

- [ ] **Paso 4.4 — Actualizar los dividers de filas en las listas**

Buscar todos los `borderBottom: idx < X.length - 1 ? "1px solid var(--color-border)" : undefined` y cambiar `var(--color-border)` por `var(--color-glass-border)`.

- [ ] **Paso 4.5 — Actualizar el título de página**

Reemplazar el `<h1 className="font-display ...">` con:

```tsx
<h1
  className="text-[24px] font-extrabold leading-none"
  style={{ color: "var(--color-text)", letterSpacing: "-0.03em" }}
>
  Resumen del Negocio
</h1>
```

- [ ] **Paso 4.6 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Abrir http://localhost:5173/dashboard. Verificar:
- 4 stat cards con fondos de color (dorado/primario, ámbar, violeta, verde)
- Cards de sección con fondo glass
- Título usa Inter extrabold (sin serif cursiva)
- Sin errores de TypeScript por props eliminadas (`accentColor`, `highlight`)

- [ ] **Paso 4.7 — Commit**

```bash
git add BarberBookSaaS.Web/src/features/dashboard/Dashboard.tsx
git commit -m "feat: rediseño Dashboard stat cards con variantes y SectionCard glass"
```

---

## Tarea 5: Rediseño Login.tsx

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/auth/Login.tsx`

- [ ] **Paso 5.1 — Actualizar el fondo de página y el glow radial**

La página actualmente usa `background: "#080808"` hardcodeado. Cambiarlo a `var(--color-bg)` para que funcione con los 3 temas. También actualizar el glow para usar `--color-primary`:

```tsx
{/* Página contenedor: */}
<div
  className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
  style={{ background: "var(--color-bg)" }}
>

{/* Glow radial: cambiar rgba hardcodeado por color-mix con primary: */}
<div
  aria-hidden
  style={{
    position: "absolute",
    top: "-10%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "600px",
    height: "400px",
    background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 7%, transparent) 0%, transparent 65%)",
    pointerEvents: "none",
  }}
/>
```

- [ ] **Paso 5.2 — Actualizar el título "BarberBook" — quitar font-display**

Localizar el `<h1 className="font-display ...">` y reemplazar:

```tsx
<h1
  className="text-[36px] leading-none font-extrabold"
  style={{ color: "var(--color-text)", letterSpacing: "-0.04em" }}
>
  BarberBook
</h1>
```

- [ ] **Paso 5.3 — Actualizar el card del formulario a glass**

Localizar el `<div className="rounded-2xl px-7 py-7" style={{ background: "#111010", border: "1px solid #1f1d1a", ... }}>` y reemplazarlo:

```tsx
<div
  className="rounded-2xl px-7 py-7"
  style={{
    background: "var(--color-glass-surface)",
    border: "1px solid var(--color-glass-border)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
  }}
>
```

- [ ] **Paso 5.4 — Actualizar el accent line superior del card**

Dentro del card, hay un `<div>` con `background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)"`. Actualizarlo para usar `--color-primary`:

```tsx
<div
  style={{
    height: 1,
    background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-primary) 40%, transparent), transparent)",
    marginBottom: 28,
    marginLeft: -28,
    marginRight: -28,
    marginTop: -28,
  }}
/>
```

- [ ] **Paso 5.5 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Abrir http://localhost:5173/login. Verificar:
- Card muestra fondo glass
- Título "BarberBook" usa Inter extrabold (no serif cursiva)
- Fondo de página usa `--color-bg` (cambia al cambiar de tema)
- Glow radial sigue el color primary del tenant

- [ ] **Paso 5.6 — Commit**

```bash
git add BarberBookSaaS.Web/src/features/auth/Login.tsx
git commit -m "feat: rediseño Login card glass + título Inter + fondo adaptable a temas"
```

---

## Tarea 6: Rediseño AppointmentManagement.tsx

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/appointments/AppointmentManagement.tsx`

- [ ] **Paso 6.1 — Actualizar `modalBox` a glass**

En `AppointmentManagement.tsx`, localizar la constante `modalBox` (cerca del top del archivo):

```tsx
// Antes:
const modalBox: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
};

// Después:
const modalBox: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
};
```

- [ ] **Paso 6.2 — Actualizar botón "Actualizar" a .btn-ghost**

Localizar el botón de refresh (tiene `RefreshCw` + texto "Actualizar") y reemplazar sus className e inline styles por la clase `btn-ghost`:

```tsx
<button
  onClick={() => loadData()}
  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg btn-ghost"
>
  <RefreshCw size={13} /> Actualizar
</button>
```

Eliminar los `onMouseEnter`/`onMouseLeave` manuales del botón Actualizar — `.btn-ghost` ya tiene el hover.

- [ ] **Paso 6.3 — Actualizar botones de filtro de estado a .btn-ghost**

Los filtros (Todas / Pendiente / Completada / Cancelada) tienen inline styles con `background: "var(--color-surface)"`. Reemplazar por `btn-ghost`, y el filtro activo por `btn-primary`:

```tsx
{FILTERS.map((f) => (
  <button
    key={f}
    onClick={() => setFilterStatus(f)}
    className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all ${
      filterStatus === f ? "btn-primary" : "btn-ghost"
    }`}
  >
    {f}
  </button>
))}
```

- [ ] **Paso 6.5 — Agregar helper de paleta de avatares**

Agregar justo antes del componente `AppointmentManagement`:

```tsx
const AVATAR_PALETTES: Array<{ bg: string; color: string; border: string }> = [
  {
    bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
    color: "var(--color-primary)",
    border: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
  },
  {
    bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
    color: "color-mix(in srgb, var(--color-secondary) 80%, white)",
    border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)",
  },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
];

function getAvatarPalette(name: string) {
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
}
```

- [ ] **Paso 6.6 — Actualizar el componente Avatar**

Reemplazar el componente `Avatar` existente:

```tsx
const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const p = getAvatarPalette(name);
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
      style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};
```

- [ ] **Paso 6.7 — Actualizar contenedor principal a glass**

Buscar el div raíz del listado de citas (generalmente tiene `background: "var(--color-surface)"` y `border: "1px solid var(--color-border)"`). Reemplazar esos inline styles:

```tsx
// Antes:
style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "..." }}

// Después:
style={{
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
}}
```

Aplicar lo mismo a cualquier otro card contenedor dentro del componente.

- [ ] **Paso 6.8 — Aumentar padding de filas y actualizar dividers**

Buscar todas las filas de citas con `py-3.5` y cambiar a `py-4`. Cambiar los dividers de `var(--color-border)` a `var(--color-glass-border)`.

```tsx
// Antes:
className="px-5 py-3.5 flex items-center gap-3.5 ..."
borderBottom: idx < X.length - 1 ? "1px solid var(--color-border)" : undefined

// Después:
className="px-5 py-4 flex items-center gap-3.5 ..."
borderBottom: idx < X.length - 1 ? "1px solid var(--color-glass-border)" : undefined
```

- [ ] **Paso 6.9 — Aumentar padding del badge de estado**

Buscar el span del badge de estado y cambiar de `px-2 py-0.5` a `px-2.5 py-1`:

```tsx
className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${STATUS_CONFIG[a.status].pill}`}
```

- [ ] **Paso 6.10 — Actualizar título de página**

```tsx
<h1
  className="text-[22px] font-extrabold leading-none"
  style={{ color: "var(--color-text)", letterSpacing: "-0.03em" }}
>
  Gestión de Citas
</h1>
```

- [ ] **Paso 6.11 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Abrir http://localhost:5173/appointments. Verificar:
- Contenedor card muestra fondo glass
- Avatares varían de color según el nombre (abrir con varias citas)
- Filas tienen más espacio vertical
- Badge de estado es ligeramente más grande

- [ ] **Paso 6.12 — Commit**

```bash
git add BarberBookSaaS.Web/src/features/appointments/AppointmentManagement.tsx
git commit -m "feat: rediseño AppointmentManagement — glass, modal, botones, avatares"
```

---

## Tarea 7: Rediseño BarberManagement.tsx

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/barbers/BarberManagement.tsx`

- [ ] **Paso 7.1 — Actualizar `modalBox` a glass**

En `BarberManagement.tsx`, localizar la constante `modalBox` cerca del top del archivo y reemplazar:

```tsx
const modalBox: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
};
```

- [ ] **Paso 7.2 — Agregar helper de paleta de avatares**

Agregar el mismo helper que en la Tarea 6, justo antes de `BarberManagement`:

```tsx
const AVATAR_PALETTES: Array<{ bg: string; color: string; border: string }> = [
  {
    bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
    color: "var(--color-primary)",
    border: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
  },
  {
    bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
    color: "color-mix(in srgb, var(--color-secondary) 80%, white)",
    border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)",
  },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
];

function getAvatarPalette(name: string) {
  return AVATAR_PALETTES[name.charCodeAt(0) % AVATAR_PALETTES.length];
}
```

- [ ] **Paso 7.3 — Actualizar BarberAvatar**

```tsx
const BarberAvatar: React.FC<{ name: string }> = ({ name }) => {
  const p = getAvatarPalette(name);
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
      style={{ background: p.bg, color: p.color, border: `1px solid ${p.border}` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
};
```

- [ ] **Paso 7.4 — Actualizar contenedor de lista a glass**

Buscar `background: "var(--color-surface)"` + `borderColor: "var(--color-border)"` y reemplazar con glass (mismo patrón que Tarea 6.7).

- [ ] **Paso 7.5 — Aumentar padding de filas y actualizar dividers**

Cambiar `py-3.5` → `py-4` en filas de barberos. Dividers de `var(--color-border)` → `var(--color-glass-border)`.

- [ ] **Paso 7.6 — Actualizar título de página**

```tsx
<h1
  className="text-[22px] font-extrabold leading-none"
  style={{ color: "var(--color-text)", letterSpacing: "-0.03em" }}
>
  Gestión de Barberos
</h1>
```

- [ ] **Paso 7.7 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Abrir http://localhost:5173/barbers. Verificar: modal glass al crear/editar barbero, avatares con color, contenedor glass, padding aumentado.

- [ ] **Paso 7.8 — Commit**

```bash
git add BarberBookSaaS.Web/src/features/barbers/BarberManagement.tsx
git commit -m "feat: rediseño BarberManagement — modal glass, paleta de avatares, glass container"
```

---

## Tarea 8: Rediseño BarberLayout.tsx sidebar

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/components/BarberLayout.tsx`

- [ ] **Paso 8.1 — Sin cambios de imports necesarios**

Los íconos necesarios (`CalendarDays`, `Clock`, `Scissors`) ya están importados. No agregar imports nuevos.

- [ ] **Paso 8.2 — Reemplazar el `<aside>` del sidebar de BarberLayout**

Localizar el `<aside className="w-56 h-full flex flex-col border-r bg-sidebar border-theme overflow-y-auto shrink-0">` y todo su contenido (líneas ~112–174). Reemplazarlo con:

```tsx
<aside
  className="w-56 h-full flex flex-col shrink-0 overflow-y-auto"
  style={{
    background: "var(--color-glass-surface)",
    borderRight: "1px solid var(--color-glass-border)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  }}
>
  {/* ── Logo + tenant pill ──────────────────────────── */}
  <div
    className="px-3 pt-4 pb-3"
    style={{ borderBottom: "1px solid var(--color-glass-border)" }}
  >
    <div className="flex items-center gap-2.5 mb-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
          boxShadow: "0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent)",
        }}
      >
        <Scissors size={13} color="#000" strokeWidth={2.5} />
      </div>
      <span
        className="text-[13px] font-bold tracking-tight"
        style={{ color: "var(--color-text)" }}
      >
        BarberBook
      </span>
    </div>
    <div className="tenant-pill flex items-center justify-between">
      <span
        className="text-[11px] font-semibold truncate"
        style={{ color: "var(--color-primary)" }}
      >
        {tenantId ?? "panel"}
      </span>
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0 ml-2"
        style={{ background: "#10b981", boxShadow: "0 0 7px rgba(16,185,129,0.8)" }}
      />
    </div>
  </div>

  {/* ── Nav ─────────────────────────────────────────── */}
  <nav className="flex-1 px-2 py-3">
    <ul className="space-y-0.5">
      <li>
        <Link
          to="/barber"
          className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all ${
            location.pathname === "/barber" ? "nav-item-active" : "nav-item-inactive"
          }`}
        >
          <span
            className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 40%, transparent)",
            }}
          >
            <CalendarDays size={13} />
          </span>
          <span>Mis Citas</span>
        </Link>
      </li>
      <li>
        <Link
          to="/barber/schedule"
          className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] font-medium transition-all ${
            location.pathname === "/barber/schedule" ? "nav-item-active" : "nav-item-inactive"
          }`}
        >
          <span
            className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center shrink-0"
            style={{ background: "rgba(245,158,11,0.18)", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <Clock size={13} />
          </span>
          <span>Mi Horario</span>
        </Link>
      </li>
    </ul>
  </nav>

  {/* ── User card ────────────────────────────────────── */}
  <div
    className="p-2.5"
    style={{ borderTop: "1px solid var(--color-glass-border)" }}
  >
    <div
      className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
      style={{
        background: "var(--color-glass-surface)",
        border: "1px solid var(--color-glass-border)",
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{
          background: "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #000))",
          color: "#000",
        }}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: "var(--color-text)" }}>
          {user?.role ?? "Barbero"}
        </p>
        <p className="text-[10px] truncate leading-tight" style={{ color: "var(--color-text-muted)" }}>
          {tenantId ?? ""}
        </p>
      </div>
      <button
        onClick={logout}
        title="Cerrar sesión"
        className="shrink-0 p-1.5 rounded-md transition-all"
        style={{ color: "var(--color-text-muted)", background: "transparent" }}
        onMouseEnter={e => {
          e.currentTarget.style.color = "#f87171";
          e.currentTarget.style.background = "rgba(239,68,68,0.1)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = "var(--color-text-muted)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <LogOut size={13} />
      </button>
    </div>
  </div>
</aside>
```

**Importante:** `ChangePasswordOverlay`, `<main>`, y `<Outlet />` no se tocan.

- [ ] **Paso 8.3 — Build + verificación visual**

```bash
cd BarberBookSaaS.Web && npm run build
```

Iniciar sesión como barbero y abrir http://localhost:5173/barber. Verificar:
- Sidebar idéntico al admin en estilo
- ChangePasswordOverlay sigue funcionando (probar con un barbero que tenga `mustChangePassword: true`)

- [ ] **Paso 8.4 — Commit**

```bash
git add BarberBookSaaS.Web/src/components/BarberLayout.tsx
git commit -m "feat: rediseño BarberLayout sidebar con glassmorphism"
```

---

## Tarea 9: Rediseño BookingPage.tsx — glass en contenedores de paso

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/booking/BookingPage.tsx`

- [ ] **Paso 9.1 — Identificar y actualizar contenedores de pasos**

Abrir `BookingPage.tsx`. Buscar todos los `<div>` que actúen como card de un paso del flujo (tienen `background: "var(--color-surface)"`, `card-theme`, o `rounded-xl border` con fondo sólido).

Para **cada uno de esos contenedores**, aplicar el patrón glass:

```tsx
style={{
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
}}
```

Si usan className como `card-theme border rounded-xl`, mantener `rounded-xl` pero agregar el style inline de glass.

**No tocar:** lógica de pasos, state de auth, disponibilidad, loyalty, modales. Solo los contenedores visuales.

- [ ] **Paso 9.2 — Build + verificación visual end-to-end**

```bash
cd BarberBookSaaS.Web && npm run build
```

Abrir http://localhost:5173/book/prueba1 (o el subdominio de prueba). Recorrer el flujo completo:
1. Selección de barbero → card glass visible
2. Selección de servicio → card glass
3. Selección de fecha/hora → card glass
4. Confirmación → funciona

- [ ] **Paso 9.3 — Commit**

```bash
git add BarberBookSaaS.Web/src/features/booking/BookingPage.tsx
git commit -m "feat: glass en contenedores de pasos de BookingPage"
```

---

## Tarea 10: Glass + títulos Inter en páginas admin secundarias

**Archivos:**
- Modificar: `BarberBookSaaS.Web/src/features/services/ServiceManagement.tsx`
- Modificar: `BarberBookSaaS.Web/src/features/reviews/AdminReviews.tsx`
- Modificar: `BarberBookSaaS.Web/src/features/branding/BrandingPage.tsx`
- Modificar: `BarberBookSaaS.Web/src/features/barbers/BarberSchedule.tsx`

En cada archivo aplicar el mismo patrón:

**A) Glass en contenedores de sección:**
Buscar los contenedores de card principales que tienen `background: "var(--color-surface)"` o `card-theme` como clase y reemplazar con:
```tsx
style={{
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
}}
```

**B) Dividers de filas:** `var(--color-border)` → `var(--color-glass-border)`

**C) Título de página:** cualquier `<h1>` con `font-display` o `font-bold text-2xl` reemplazar con:
```tsx
<h1
  className="text-[22px] font-extrabold leading-none"
  style={{ color: "var(--color-text)", letterSpacing: "-0.03em" }}
>
  {/* título de la página */}
</h1>
```

- [ ] **Paso 10.1 — ServiceManagement.tsx**

Aplicar patrón A + B + C. Build y abrir http://localhost:5173/services.

```bash
cd BarberBookSaaS.Web && npm run build
```

- [ ] **Paso 10.2 — AdminReviews.tsx**

Aplicar patrón A + B + C. Build y abrir http://localhost:5173/reviews.

```bash
cd BarberBookSaaS.Web && npm run build
```

- [ ] **Paso 10.3 — BrandingPage.tsx**

Aplicar patrón A + B + C. Build y abrir http://localhost:5173/branding.

```bash
cd BarberBookSaaS.Web && npm run build
```

- [ ] **Paso 10.4 — BarberSchedule.tsx**

Aplicar patrón A + B + C. Build y abrir http://localhost:5173/barber/schedule (con sesión de barbero).

```bash
cd BarberBookSaaS.Web && npm run build
```

- [ ] **Paso 10.5 — Commit**

```bash
git add \
  BarberBookSaaS.Web/src/features/services/ServiceManagement.tsx \
  BarberBookSaaS.Web/src/features/reviews/AdminReviews.tsx \
  BarberBookSaaS.Web/src/features/branding/BrandingPage.tsx \
  BarberBookSaaS.Web/src/features/barbers/BarberSchedule.tsx
git commit -m "feat: glass + títulos Inter en páginas admin y barbero secundarias"
```

---

## Verificación final

- [ ] **Cambiar tema a `antigravity`** en BrandingPage y verificar que sidebar, cards y stat cards se adaptan al fondo azul/violeta.
- [ ] **Cambiar tema a `light-modern`** y verificar legibilidad (glass sobre fondo blanco usa `rgba(0,0,0,0.025)` — debe ser sutil pero visible).
- [ ] **Cambiar primary color** a algo diferente (ej. `#2563EB`) y verificar que sidebar active, tenant pill, stat card primary y botones siguen el nuevo color.
- [ ] **Tests del backend** no deben fallar (los cambios son puramente frontend):

```bash
cd BarberBookSaaS.Tests
dotnet test
```

Esperado: 13/13 pasan.