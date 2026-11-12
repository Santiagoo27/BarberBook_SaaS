# BarberBook SaaS — Rediseño UI Premium

**Fecha:** 2026-06-04  
**Estado:** Aprobado  
**Alcance:** Admin panel + Panel Barbero + Booking público + Login

---

## Resumen

Rediseño visual completo del frontend de BarberBook SaaS con estética **Raycast / Glassmorphism**. El objetivo es pasar de un diseño oscuro plano a un sistema visual con profundidad, jerarquía clara y fuentes de alta calidad — sin depender de CDNs externos.

**Lo que NO cambia:** lógica de negocio, servicios, API calls, rutas, context de auth, portales de modales, animaciones existentes.

---

## Decisiones de diseño confirmadas

| Decisión | Elección |
|----------|----------|
| Dirección visual | Raycast / Glassmorphism |
| Fuente | Inter — local via `@font-face` desde `/public/fonts/` |
| Sidebar admin | Full width con íconos de color semitransparente por sección |
| Compatibilidad temas | Los 3 temas (dark-premium, antigravity, light-modern) |
| Compatibilidad colores | Sí — todo pasa por `--color-primary` / `--color-secondary` |
| Alcance de vistas | Admin + Barbero + Booking público + Login |
| SuperAdmin | Fuera de scope (tema independiente) |

---

## 1. Sistema de diseño

### 1.1 Fuentes

**Eliminar** el `@import` de Google Fonts en `index.css`:
```css
/* ELIMINAR estas dos líneas */
@import url('https://fonts.googleapis.com/...');
```

**Agregar** Inter local via `@font-face`. Instalar con npm (`npm install @fontsource/inter`) y copiar los `.woff2` necesarios de `node_modules/@fontsource/inter/files/` a `public/fonts/`, o descargarlos directamente desde [rsms.me/inter](https://rsms.me/inter/). Colocar en `BarberBookSaaS.Web/public/fonts/`:

| Archivo | Peso | Uso |
|---------|------|-----|
| `Inter-Regular.woff2` | 400 | Texto base, metadatos |
| `Inter-Medium.woff2` | 500 | Labels, nav items |
| `Inter-SemiBold.woff2` | 600 | Nombres, títulos de sección |
| `Inter-Bold.woff2` | 700 | Headings, botones |
| `Inter-ExtraBold.woff2` | 800 | Valores numéricos grandes (stat cards) |

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400; font-display: swap;
}
/* ... repetir para 500, 600, 700, 800 */
```

**Body:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

**Eliminar** la clase `.font-display` (usaba Cormorant Garamond). Los títulos de página que la usaban (`h1.font-display`) pasan a Inter 700–800 con `letter-spacing: -0.03em`. Mismo efecto sofisticado, sin CDN.

### 1.2 Nuevas variables CSS de glassmorphism

Agregar a cada tema en `ThemeContext.tsx`:

```ts
"dark-premium": {
  // ...variables existentes...
  "--color-glass-surface": "rgba(255, 255, 255, 0.025)",
  "--color-glass-border":  "rgba(255, 255, 255, 0.07)",
  "--color-glass-surface-hover": "rgba(255, 255, 255, 0.04)",
},
"antigravity": {
  // ...variables existentes...
  "--color-glass-surface": "rgba(255, 255, 255, 0.035)",
  "--color-glass-border":  "rgba(255, 255, 255, 0.09)",
  "--color-glass-surface-hover": "rgba(255, 255, 255, 0.055)",
},
"light-modern": {
  // ...variables existentes...
  "--color-glass-surface": "rgba(0, 0, 0, 0.025)",
  "--color-glass-border":  "rgba(0, 0, 0, 0.07)",
  "--color-glass-surface-hover": "rgba(0, 0, 0, 0.04)",
},
```

### 1.3 Nuevas clases en `index.css`

```css
/* Glassmorphism base */
.glass {
  background: var(--color-glass-surface);
  border: 1px solid var(--color-glass-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Stat card semitransparente por color */
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
}

/* Tenant pill */
.tenant-pill {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent);
  border-radius: 7px;
  padding: 5px 10px;
}
```

---

## 2. Sidebar admin (`Sidebar.tsx`)

### Cambios visuales

**Logo icon:** gradiente `var(--color-primary)` con `box-shadow` glow — ya existe, mantener.

**Tenant pill:** reemplaza el área actual de nombre+tenant. Muestra el subdominio con un punto verde de estado online:
```
┌─────────────────────────────┐
│  🟡 BarberBook               │
│ ┌─────────────────────────┐ │
│ │  prueba1          🟢    │ │  ← tenant-pill
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Nav items:** íconos con fondos de color semitransparente por sección:
- **Inicio** → ícono con `background: gradient(primary)`, glow sutil
- **Citas** → ícono con `background: rgba(245,158,11,0.18)` + border ámbar
- **Barberos** → ícono con `background: rgba(secondary,0.18)` + border secondary  
- **Servicios** → ícono con `background: rgba(255,255,255,0.06)` neutro
- **Reseñas** → ícono con `background: rgba(251,191,36,0.14)` + border amarillo
- **Mi Barbería** → ícono con `background: rgba(16,185,129,0.18)` + border verde

Separador entre secciones: línea `1px solid var(--color-glass-border)` en vez de labels de texto "Principal"/"Gestión".

**User card (bottom):** `glass` class + avatar con gradiente primary.

**Fondo sidebar:** `var(--color-glass-surface)` + `backdrop-filter: blur(24px)` — reemplaza `bg-sidebar`.

### Interfaz `NavItem`

El campo `section` se mantiene para determinar el color del ícono, pero los labels de sección desaparecen del DOM.

---

## 3. BarberLayout sidebar

BarberLayout tiene su propio sidebar simplificado (solo Inicio + Horario + logout). Recibe el mismo tratamiento:
- `var(--color-glass-surface)` + `backdrop-filter`
- Íconos con fondos de color (Inicio = primary, Horario = amber)
- Tenant pill igual que el admin
- User card idéntico

---

## 4. Dashboard (`Dashboard.tsx`)

### Stat cards

Pasar de `border-top: 2px solid accent` a fondos semitransparentes por métrica:

| Métrica | Clase | Valor color |
|---------|-------|-------------|
| Citas Hoy | `.stat-card-primary` | `--color-primary` |
| Pendientes | `.stat-card-amber` | ámbar fijo (es estado, no marca) |
| Barberos Activos | `.stat-card-violet` | `--color-secondary` |
| Ingresos Hoy | `.stat-card-green` | verde fijo (es éxito/dinero) |

Valor numérico: mantener `text-[28px] font-bold` → cambiar a `font-extrabold` (800). El color del valor sigue al acento: primary/ámbar/secondary/verde según la card.

Ícono: `w-8 h-8 rounded-lg` con background `color-mix(in srgb, accentColor 20%, transparent)`.

**Eliminar** el prop `highlight` que pintaba toda la card en `--color-primary`. Reemplazado por el sistema de `stat-card-*`. La urgencia de citas pendientes se comunica ahora via el glow ámbar de `.stat-card-amber` (`box-shadow: 0 0 20px rgba(245,158,11,0.06)`) más el color del valor numérico en `#f59e0b` — mismo efecto de alerta, menos agresivo visualmente.

### `SectionCard`

Fondo pasa de `var(--color-surface)` sólido a `var(--color-glass-surface)` + `backdrop-filter: blur(12px)`.

Accent bar lateral: mantener, pero usar `linear-gradient(180deg, var(--color-primary), var(--color-secondary))` para mayor personalidad.

### Título de página

Reemplazar `font-display italic font-light text-[36px]` por Inter `text-[24px] font-extrabold tracking-tight`. El efecto de "display elegante" se logra con el peso y el tracking negativo sin necesidad de serif.

---

## 5. AppointmentManagement (`AppointmentManagement.tsx`)

### Filas de citas

Aumentar padding vertical de cada fila de `py-3.5` a `py-4` (de ~14px a 16px).

**Avatar:** mantener la lógica actual pero agregar variación de color por initial letter para dar personalidad visual:
- Función `getAvatarColor(name: string)` → devuelve uno de 4 gradientes basados en `charCodeAt(0) % 4`:
  0. primary (dorado por defecto)
  1. secondary (violeta)
  2. verde
  3. ámbar

**Metadatos (barbero · servicio):** aumentar separación visual añadiendo `gap-1.5` entre el nombre y el meta, y usar `·` con más espacio: `{barber} · {service}` (ya existe, solo más padding).

**Badge de estado:** aumentar de `px-2 py-0.5 text-[11px]` a `px-2.5 py-1 text-[11px]` para más presencia.

**Contenedor general:** de `var(--color-surface)` a `var(--color-glass-surface)` + `backdrop-filter`.

### Filtros de estado

Los botones de filtro (Todas / Pendiente / Completada / Cancelada) reciben el mismo tratamiento glass: fondo `var(--color-glass-surface)` con borde activo en `--color-primary`.

---

## 6. BarberManagement (`BarberManagement.tsx`)

### Cards de barbero

Cada barbero en la lista recibe `py-4` de padding (actualmente `py-3.5`), mismo sistema de avatar con color por inicial.

Los botones de acción (Editar / Horario / Eliminar) pasan de text-muted plano a icon buttons con hover de fondo glass.

Sin cambios en la lógica de modales (portales ya están bien).

---

## 7. Login (`Login.tsx`)

### Card principal

Reemplazar el `div` contenedor del formulario de fondo sólido por card glass:
```
background: var(--color-glass-surface)
border: 1px solid var(--color-glass-border)
backdrop-filter: blur(24px)
border-radius: 16px
padding: 32px
box-shadow: 0 32px 80px rgba(0,0,0,0.6)
```

### Tenant display pill

El paso 2 del login (cuando ya se detectó el tenant) muestra el nombre de la barbería + logo como un pill visual (igual al tenant pill del sidebar) antes del formulario de contraseña.

### Fondo

Mantener el `radial-gradient` dorado y el `repeating-linear-gradient` diagonal — ya son correctos para la estética.

### Título

`font-display italic` → Inter `font-extrabold tracking-tight`.

---

## 8. Booking público (`BookingPage.tsx`)

### Alcance

Aplicar Inter + glassmorphism a las cards de cada paso del flujo de reserva. La lógica de pasos, auth de cliente y loyalty no cambia.

### Cards de paso

Los contenedores de cada paso (selección de barbero, servicio, fecha, confirmación) reciben:
```
background: var(--color-glass-surface)
border: 1px solid var(--color-glass-border)
backdrop-filter: blur(16px)
border-radius: 14px
```

### Colores

`--color-primary` del tenant ya se aplica via ThemeContext en el booking. El botón "Confirmar cita" y los elementos activos ya siguen el color del negocio — no cambia la lógica, solo el fondo de los contenedores.

---

## 9. Archivos a modificar

| Archivo | Tipo de cambio |
|---------|---------------|
| `index.css` | Eliminar Google Fonts import; agregar @font-face Inter; nuevas clases glass/stat-card-* |
| `context/ThemeContext.tsx` | Agregar `--color-glass-surface` y `--color-glass-border` a los 3 temas |
| `components/Sidebar.tsx` | Tenant pill, nav íconos de color, fondo glass, sin section labels |
| `components/AdminLayout.tsx` | Verificar que `h-screen overflow-y-auto` se mantenga (ya correcto) |
| `components/BarberLayout.tsx` | Mismo tratamiento glass que Sidebar admin |
| `features/dashboard/Dashboard.tsx` | Stat cards con fondos semitransparentes, títulos sin font-display |
| `features/appointments/AppointmentManagement.tsx` | Padding aumentado, avatar colores, badge más grande, glass container |
| `features/barbers/BarberManagement.tsx` | Padding de filas, avatar colores |
| `features/auth/Login.tsx` | Card glass, tenant pill visual, eliminar font-display |
| `features/booking/BookingPage.tsx` | Cards de pasos con glass |
| `features/services/ServiceManagement.tsx` | Contenedor principal y filas de servicios con glass |
| `features/reviews/AdminReviews.tsx` | Contenedores de sección con glass |
| `features/branding/BrandingPage.tsx` | Contenedores de sección con glass |
| `features/barbers/BarberSchedule.tsx` | Contenedor glass (dentro de BarberLayout) |
| `public/fonts/` | Agregar archivos Inter .woff2 (400, 500, 600, 700, 800) |

**No se modifican:** rutas, context de auth, context de theme (solo se agregan variables), servicios, tipos, modales con portales, lógica de negocio.

---

## 10. Consideraciones de compatibilidad

### light-modern

El glassmorphism usa `rgba(0,0,0,X)` en lugar de `rgba(255,255,255,X)`. El `backdrop-filter` en tema claro se mantiene pero con valores de opacidad más bajos (0.025–0.04) para no perder el contraste sobre fondo blanco.

### Temas con color primario oscuro

Si un admin configura un `--color-primary` muy oscuro (ej. `#1a1a1a`), las clases `stat-card-primary` tendrán fondos casi invisibles. Se agrega un fallback: si el contraste es insuficiente, usar `var(--color-surface)` como background. Implementado con `@supports` + CSS `color-contrast()` — o simplemente documentar que el sistema está optimizado para colores primarios de saturación media-alta.

### `backdrop-filter` en modales

Los modales ya usan `createPortal` + inline styles. El `backdrop-filter: blur(2px)` del backdrop del modal ya existe y no se toca.

---

## 11. Orden de implementación sugerido

1. Descargar Inter y configurar `@font-face` en `index.css` + eliminar Google Fonts
2. Agregar variables glass a `ThemeContext.tsx`
3. Agregar clases utilitarias a `index.css`
4. Rediseñar `Sidebar.tsx`
5. Rediseñar `Dashboard.tsx` (stat cards + section cards)
6. Rediseñar `Login.tsx`
7. Rediseñar `AppointmentManagement.tsx`
8. Rediseñar `BarberManagement.tsx`
9. Rediseñar `BarberLayout.tsx` sidebar
10. Rediseñar `BookingPage.tsx` (solo los contenedores de pasos)