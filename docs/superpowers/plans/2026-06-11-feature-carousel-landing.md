# Carrusel Spotlight para sección "Características" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la grilla `feature-grid` (3×2) de la sección "Todo lo que necesita tu barbería" en `LandingPage.tsx` por un carrusel "Spotlight": una tarjeta grande centrada por slide, con avance automático en bucle, drag/swipe y controles (flechas + puntos).

**Architecture:** Un nuevo componente autocontenido `FeatureCarousel` (`src/components/FeatureCarousel.tsx`) recibe `items: FeatureCarouselItem[]` (mismo shape que `FEATURES`: `icon`, `title`, `description`) y renderiza cada uno dentro de `GlowCard`. La mecánica de drag/animación replica el patrón `motion.div` con `useMotionValue` + `animate={{ translateX }}` del snippet de referencia, simplificado a "siempre 1 slide visible" (sin `IntersectionObserver`/`visibleItemsCount`). El tamaño de la tarjeta es fluido vía `clamp()` (sin media queries nuevas).

**Tech Stack:** React 19 + TypeScript, `motion/react` (ya instalado), `lucide-react` (ya instalado). Sin dependencias nuevas.

---

## Mapa de archivos

- **Crear** `BarberBookSaaS.Web/src/components/FeatureCarousel.tsx` — componente del carrusel: estado de índice, autoplay con pausa, drag, render de slides (`GlowCard`) y controles (flechas + puntos).
- **Modificar** `BarberBookSaaS.Web/src/index.css` — agrega `.spotlight-track` / `.spotlight-card` / `.spotlight-controls`; luego elimina la clase `.feature-grid` (queda sin uso).
- **Modificar** `BarberBookSaaS.Web/src/features/landing/LandingPage.tsx` — importa `FeatureCarousel` y reemplaza el `<div className="feature-grid">` de la sección `caracteristicas`.

---

### Task 1: Crear el componente `FeatureCarousel`

**Files:**
- Create: `BarberBookSaaS.Web/src/components/FeatureCarousel.tsx`

- [ ] **Step 1: Crear el archivo del componente**

```tsx
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GlowCard } from "./GlowCard";

const BRAND = "#9CA3AF";
const BORDER = "#1e1e1e";
const TEXT = "#f5f5f5";
const TEXT_MUTED = "#8a8a8a";
const RESUME_DELAY = 4000;

function withAlpha(hex: string, alpha: number) {
  return `color-mix(in srgb, ${hex} ${Math.round(alpha * 100)}%, transparent)`;
}

export interface FeatureCarouselItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureCarouselProps {
  items: FeatureCarouselItem[];
  autoPlayInterval?: number;
}

export function FeatureCarousel({ items, autoPlayInterval = 6000 }: FeatureCarouselProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const dragX = useMotionValue(0);
  const resumeTimeoutRef = useRef<number | null>(null);
  const itemsCount = items.length;

  const goTo = (newIndex: number) => {
    setIndex(((newIndex % itemsCount) + itemsCount) % itemsCount);
  };

  const pauseAutoplay = () => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setAutoplayPaused(true);
  };

  const scheduleResume = () => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
    }
    resumeTimeoutRef.current = window.setTimeout(() => {
      setAutoplayPaused(false);
    }, RESUME_DELAY);
  };

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || autoplayPaused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % itemsCount);
    }, autoPlayInterval);
    return () => window.clearInterval(id);
  }, [reduceMotion, autoplayPaused, itemsCount, autoPlayInterval]);

  const onDragEnd = () => {
    const x = dragX.get();
    if (x <= -10) {
      goTo(index + 1);
    } else if (x >= 10) {
      goTo(index - 1);
    }
    scheduleResume();
  };

  const handleNavClick = (newIndex: number) => {
    goTo(newIndex);
    pauseAutoplay();
    scheduleResume();
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Funciones de BarberBook"
      style={{ marginTop: "4rem" }}
      onPointerEnter={pauseAutoplay}
      onPointerLeave={scheduleResume}
    >
      <div className="spotlight-track">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragMomentum={false}
          style={{ x: dragX, display: "flex", cursor: "grab" }}
          animate={{ translateX: `-${index * 100}%` }}
          onDragStart={pauseAutoplay}
          onDragEnd={onDragEnd}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", damping: 18, stiffness: 90, duration: 0.2 }
          }
        >
          {items.map(({ icon: Icon, title, description }) => (
            <div key={title} style={{ width: "100%", flexShrink: 0 }}>
              <GlowCard className="spotlight-card">
                <div
                  style={{
                    width: "clamp(44px, 8vw, 64px)",
                    height: "clamp(44px, 8vw, 64px)",
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: withAlpha(BRAND, 0.12),
                    margin: "0 auto 24px",
                  }}
                >
                  <Icon size={28} color={BRAND} strokeWidth={2} />
                </div>
                <h3
                  style={{
                    fontSize: "clamp(1.25rem, 4vw, 1.625rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    margin: "0 0 12px",
                    color: TEXT,
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontSize: "clamp(0.9375rem, 2vw, 1rem)",
                    lineHeight: 1.7,
                    color: TEXT_MUTED,
                    margin: 0,
                  }}
                >
                  {description}
                </p>
              </GlowCard>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="spotlight-controls">
        <CarouselArrow direction="prev" onClick={() => handleNavClick(index - 1)} />
        <div style={{ display: "flex", gap: 8 }}>
          {items.map(({ title }, i) => (
            <button
              key={title}
              type="button"
              aria-label={`Ir a la función ${i + 1}: ${title}`}
              onClick={() => handleNavClick(i)}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: i === index ? BRAND : withAlpha(TEXT_MUTED, 0.4),
                transition: "all 200ms ease",
              }}
            />
          ))}
        </div>
        <CarouselArrow direction="next" onClick={() => handleNavClick(index + 1)} />
      </div>
    </div>
  );
}

function CarouselArrow({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Función anterior" : "Función siguiente"}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: `1px solid ${hover ? BRAND : BORDER}`,
        background: hover ? withAlpha(BRAND, 0.12) : "transparent",
        color: hover ? BRAND : TEXT_MUTED,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "border-color 150ms ease, background-color 150ms ease, color 150ms ease",
      }}
    >
      <Icon size={18} />
    </button>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd BarberBookSaaS.Web; npx tsc -b`
Expected: termina sin output y sin errores (el componente no se usa todavía, pero al ser `export` no dispara `noUnusedLocals`).

- [ ] **Step 3: Commit**

```bash
git add BarberBookSaaS.Web/src/components/FeatureCarousel.tsx
git commit -m "feat: add FeatureCarousel spotlight component"
```

---

### Task 2: Agregar estilos del carrusel a `index.css`

**Files:**
- Modify: `BarberBookSaaS.Web/src/index.css:396-403`

- [ ] **Step 1: Insertar las clases del carrusel después del bloque `.gallery-title`**

El archivo tiene actualmente (líneas 396-403):

```css
.gallery-title {
  font-size: 1.5rem;
}
@media (max-width: 1024px) {
  .gallery-title { font-size: 1.125rem; }
}

/* ── GlowCard: tarjeta plateada con resplandor que sigue el cursor ── */
[data-glow] {
```

Insertar el nuevo bloque entre el cierre de `.gallery-title` (línea 401) y el comentario de GlowCard (línea 403), quedando así:

```css
.gallery-title {
  font-size: 1.5rem;
}
@media (max-width: 1024px) {
  .gallery-title { font-size: 1.125rem; }
}

/* ── Landing: carrusel spotlight de "Características" ── */
.spotlight-track {
  width: 100%;
  overflow: hidden;
}

.spotlight-card {
  max-width: 620px;
  width: 100%;
  margin: 0 auto;
  text-align: center;
  padding: clamp(24px, 6vw, 48px) clamp(20px, 5vw, 40px);
  box-sizing: border-box;
}

.spotlight-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
}

/* ── GlowCard: tarjeta plateada con resplandor que sigue el cursor ── */
[data-glow] {
```

(No requiere paso de verificación aislado — se valida visualmente en la Tarea 5.)

---

### Task 3: Integrar `FeatureCarousel` en `LandingPage.tsx`

**Files:**
- Modify: `BarberBookSaaS.Web/src/features/landing/LandingPage.tsx:24-26` (imports)
- Modify: `BarberBookSaaS.Web/src/features/landing/LandingPage.tsx:742-748` (sección `caracteristicas`)

- [ ] **Step 1: Agregar el import de `FeatureCarousel`**

Cambiar (líneas 24-26):

```tsx
import { BackgroundPaths } from "../../components/BackgroundPaths";
import { GlowCard } from "../../components/GlowCard";
import { BackgroundGradientAnimation } from "../../components/BackgroundGradientAnimation";
```

por:

```tsx
import { BackgroundPaths } from "../../components/BackgroundPaths";
import { GlowCard } from "../../components/GlowCard";
import { BackgroundGradientAnimation } from "../../components/BackgroundGradientAnimation";
import { FeatureCarousel } from "../../components/FeatureCarousel";
```

- [ ] **Step 2: Reemplazar la grilla `feature-grid` por el carrusel**

Cambiar (líneas 742-748):

```tsx
            <div className="feature-grid">
              {FEATURES.map((feature, i) => (
                <Reveal key={feature.title} delay={(i % 3) * 0.08}>
                  <FeatureCard {...feature} />
                </Reveal>
              ))}
            </div>
```

por:

```tsx
            <Reveal>
              <FeatureCarousel items={FEATURES} />
            </Reveal>
```

- [ ] **Step 3: Verificar tipos**

Run: `cd BarberBookSaaS.Web; npx tsc -b`
Expected: termina sin output y sin errores.

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.Web/src/index.css BarberBookSaaS.Web/src/features/landing/LandingPage.tsx
git commit -m "feat: reemplaza grilla de Caracteristicas por carrusel spotlight"
```

---

### Task 4: Eliminar la clase `.feature-grid` sin uso

**Files:**
- Modify: `BarberBookSaaS.Web/src/index.css:272-284`

- [ ] **Step 1: Confirmar que no queda ninguna referencia a `feature-grid`**

Run: `grep -rn "feature-grid" BarberBookSaaS.Web/src/`
Expected: ninguna coincidencia (la única referencia en JSX se eliminó en la Tarea 3; las definiciones CSS se eliminan a continuación).

- [ ] **Step 2: Eliminar el bloque CSS**

Eliminar de `BarberBookSaaS.Web/src/index.css` (líneas 272-284):

```css
/* ── Landing: grid de "Características" (6 tarjetas) ──── */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 4rem;
}
@media (max-width: 1024px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .feature-grid { grid-template-columns: 1fr; }
}

```

- [ ] **Step 3: Lint**

Run: `cd BarberBookSaaS.Web; npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add BarberBookSaaS.Web/src/index.css
git commit -m "chore: elimina clase feature-grid sin uso"
```

---

### Task 5: Verificación visual en navegador

**Files:** ninguno (solo verificación)

- [ ] **Step 1: Levantar el servidor de desarrollo**

Run (en background): `cd BarberBookSaaS.Web; npm run dev`
Expected: Vite sirve en `http://localhost:5173/`.

- [ ] **Step 2: Abrir la landing y revisar la sección "Características"**

Con Playwright MCP:
- `browser_navigate` a `http://localhost:5173/`
- `browser_snapshot` o scroll hasta la sección `#caracteristicas`
- `browser_take_screenshot` — confirmar que se ve **una sola tarjeta grande** centrada (icono + título + descripción) con flechas y puntos debajo, en lugar de la grilla 3×2.

- [ ] **Step 3: Probar navegación manual**

- Click en la flecha derecha (›) → la tarjeta cambia a la siguiente función (título distinto).
- Click en un punto indicador distinto al activo → salta directo a esa función.
- Click en la flecha izquierda (‹) desde el primer slide → debe ir al último (loop).

- [ ] **Step 4: Probar autoplay**

- Sin interactuar, esperar ~7s (mayor a `autoPlayInterval=6000ms`) y volver a tomar screenshot → el slide debe haber avanzado solo.
- Hacer hover sobre el carrusel y esperar — el slide NO debe cambiar mientras el cursor esté encima.

- [ ] **Step 5: Probar responsividad**

- `browser_resize` a 375×800 (móvil) → la tarjeta debe ocupar el ancho disponible sin overflow horizontal, textos legibles, controles centrados.
- `browser_resize` de vuelta a 1280×800 (desktop) → la tarjeta vuelve a su `max-width: 620px` centrada.

- [ ] **Step 6: Cerrar el servidor de desarrollo**

Detener el proceso de `npm run dev` iniciado en el Step 1.

Si algún paso de esta tarea revela un problema visual o de comportamiento, corregirlo en `FeatureCarousel.tsx` o `index.css`, repetir la verificación, y crear un commit adicional `fix: ...` con el ajuste.