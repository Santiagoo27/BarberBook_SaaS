# BarberBook SaaS — Carrusel Spotlight para sección "Características"

**Fecha:** 2026-06-11
**Estado:** Aprobado
**Alcance:** `BarberBookSaaS.Web/src/features/landing/LandingPage.tsx` (sección `caracteristicas`)

---

## Resumen

La sección `id="caracteristicas"` ("Todo lo que necesita tu barbería") muestra hoy los 6 items de `FEATURES` en una grilla `feature-grid` (3 columnas → 2 → 1). Se reemplaza por un **carrusel "Spotlight"**: una tarjeta grande centrada por slide, con avance automático, navegación por flechas/puntos y drag/swipe.

**Lo que NO cambia:** el array `FEATURES` (icon/title/description), `FeatureCard`/`GlowCard` (siguen usándose en la sección "Qué es BarberBook" con `value-grid`), el resto de secciones de la landing.

---

## Decisiones confirmadas

| Decisión | Elección |
|----------|----------|
| Layout | Spotlight: 1 tarjeta grande centrada por slide (icono + título + descripción), reutilizando `GlowCard` |
| Controles | Una sola fila debajo de la tarjeta: flecha ‹ — puntos indicadores (clicables) — flecha › |
| Responsividad | Solo cambia tamaño (padding, fuentes, ancho de tarjeta) vía media queries — el layout (tarjeta + barra de controles) es el mismo en todos los breakpoints |
| Navegación | Avance automático cada ~6s, en bucle infinito; pausa con hover/drag y se reanuda tras unos segundos |
| Accesibilidad | Si `prefers-reduced-motion`, se desactiva el avance automático (queda navegación manual) |
| Dependencias | Ninguna nueva — `motion/react` y `lucide-react` ya están instalados; `cn` se define localmente como en `CircularGallery.tsx` (sin `@/lib/utils`, sin `clsx`/`tailwind-merge`) |

---

## 1. Componente `src/components/FeatureCarousel.tsx`

Componente autocontenido y específico para esta sección (no genérico/reutilizable — sin provider/context exportados como en el snippet original, ya que solo hay un uso).

**Props:**
```ts
interface FeatureCarouselItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface FeatureCarouselProps {
  items: FeatureCarouselItem[];
  autoPlayInterval?: number; // default 6000
}
```

**Estado interno:** `index` (slide activa), `isInteracting` (drag/hover activo, pausa el autoplay).

**Estructura visual (de afuera hacia adentro):**
1. Contenedor `overflow: hidden` (`.spotlight-track`)
2. `motion.div` con `drag="x"`, `dragConstraints={{left:0,right:0}}`, `dragMomentum={false}`, `animate={{ translateX: -index * 100 + "%" }}` — igual mecánica que el snippet original pero sin `IntersectionObserver`/`visibleItemsCount` (siempre 1 ítem visible)
3. Por cada item: `<GlowCard className="spotlight-card">` con icono (caja redondeada con `withAlpha(BRAND, 0.12)` de fondo), título (`sectionTitle`-like pero tamaño menor) y descripción (`sectionLead`-like), todo centrado
4. Barra de controles (`.spotlight-controls`): botón ‹ (circular, estilo `CtaButton variant="outline"` pero `size` icon-only), puntos (`button` por cada item, activo = más ancho/relleno con `BRAND`), botón ›

**Navegación (loop):**
- `goTo(i)`: `setIndex(((i % itemsCount) + itemsCount) % itemsCount)`
- Flecha ‹ → `goTo(index - 1)`, flecha › → `goTo(index + 1)`, sin `disabled` (siempre navegable)
- `onDragEnd`: igual umbral que el original (`x <= -10` → next, `x >= 10` → prev), con loop

**Autoplay:**
- `useEffect` con `setInterval(() => goTo(index + 1), autoPlayInterval)`, limpiado en cada cambio de `index`/`isInteracting`
- No se arranca el intervalo si `useReducedMotion()` es `true` o si `isInteracting` es `true`
- `isInteracting = true` en `onPointerEnter`/`onDragStart`, vuelve a `false` con un `setTimeout` (~4s) en `onPointerLeave`/`onDragEnd`

**Transición:** `transition={{ type: "spring", damping: 18, stiffness: 90, duration: 0.2 }}` igual que el original; si `useReducedMotion()`, `transition={{ duration: 0 }}`

**Accesibilidad:**
- Botones con `aria-label="Anterior"` / `aria-label="Siguiente"` / `aria-label="Ir a la función {n}"`
- `role="region"` + `aria-roledescription="carousel"` en el contenedor

---

## 2. Estilos — `index.css`

Nuevas clases siguiendo el patrón de `.gallery-container`/`.gallery-title` (media queries en vez de utilidades Tailwind arbitrarias):

```css
/* ── Landing: carrusel spotlight de "Características" ── */
.spotlight-card {
  max-width: 620px;
  margin: 0 auto;
  padding: 48px 40px;
  text-align: center;
}
@media (max-width: 640px) {
  .spotlight-card { padding: 32px 24px; max-width: 100%; }
}

.spotlight-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
}
```

(Tamaños de icono/título/descripción ajustados con `clamp()` inline, igual que `sectionTitle`/`sectionLead` ya hacen en el archivo.)

---

## 3. Integración en `LandingPage.tsx`

- Import: `import { FeatureCarousel } from "../../components/FeatureCarousel";`
- En la sección `id="caracteristicas"`, reemplazar:
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
- La regla CSS `.feature-grid` en `index.css` puede quedar sin uso — se elimina si tras el cambio no la referencia ningún otro componente (verificar con grep antes de borrar).

---

## Fuera de alcance

- No se toca la sección "Qué es BarberBook" (`value-grid`/`FeatureCard`) ni ninguna otra sección de la landing.
- No se crea un sistema de carrusel genérico/reutilizable — si en el futuro se necesita en otra sección, se evalúa extraer entonces.