import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, type HTMLAttributes } from "react";

const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(" ");
};

export interface GalleryItem {
  common: string;
  binomial: string;
  photo: {
    url: string;
    text: string;
    pos?: string;
    by: string;
  };
}

interface CardSize {
  width: number;
  height: number;
  marginLeft: number;
  marginTop: number;
}

function getResponsiveLayout(width: number): { radius: number; card: CardSize } {
  if (width < 640) {
    return { radius: 220, card: { width: 200, height: 280, marginLeft: -100, marginTop: -140 } };
  }
  if (width <= 1024) {
    return { radius: 350, card: { width: 220, height: 300, marginLeft: -110, marginTop: -150 } };
  }
  return { radius: 600, card: { width: 300, height: 400, marginLeft: -150, marginTop: -200 } };
}

interface CircularGalleryProps extends HTMLAttributes<HTMLDivElement> {
  items: GalleryItem[];
  /** Controla qué tan lejos están las tarjetas del centro. Si no se indica, se calcula según el ancho de pantalla. */
  radius?: number;
  /** Controla la velocidad de auto-rotación cuando no hay scroll ni swipe. */
  autoRotateSpeed?: number;
  /** Índice de la tarjeta seleccionada — se resalta con el color primario del branding. */
  selectedIndex?: number | null;
  /** Callback al hacer clic/tap sobre una tarjeta. */
  onItemClick?: (item: GalleryItem, index: number) => void;
  /** Si es `true`, desactiva el control interno por scroll de página y swipe táctil — un control externo maneja la rotación vía ref. */
  externalControl?: boolean;
}

/** API imperativa expuesta vía ref para controles externos (wheel, drag, swipe). */
export interface CircularGalleryHandle {
  addRotation: (delta: number) => void;
  setInteracting: (value: boolean) => void;
}

const CircularGallery = React.forwardRef<CircularGalleryHandle, CircularGalleryProps>(
  ({ items, className, radius: radiusProp, autoRotateSpeed = 0.02, selectedIndex, onItemClick, externalControl = false, ...props }, ref) => {
    const [rotation, setRotation] = useState(0);
    const [isInteracting, setIsInteracting] = useState(false);
    const [windowWidth, setWindowWidth] = useState(() =>
      typeof window !== "undefined" ? window.innerWidth : 1280
    );

    const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchStartRotationRef = useRef(0);

    // Responsive: radio y tamaño de tarjeta según ancho de pantalla
    useEffect(() => {
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const { radius: responsiveRadius, card } = getResponsiveLayout(windowWidth);
    const radius = radiusProp ?? responsiveRadius;

    // Tamaño de fuente del pie de card adaptado al tamaño de card actual
    const titleSizeClass = card.width >= 300 ? "text-lg" : card.width >= 220 ? "text-base" : "text-sm";
    const subtitleFontSize = card.width >= 300 ? 11 : card.width >= 220 ? 10 : 9;
    // Franja de transición foto -> pie sólido, proporcional al alto de la card
    const fadeHeight = Math.round(card.height * 0.15);
    // Padding del pie: más compacto en mobile
    const footerPadding = card.width >= 300 ? "10px 14px 14px" : card.width >= 220 ? "8px 12px 12px" : "6px 10px 8px";

    // Rotación basada en scroll de la página (desactivado si un control externo maneja la rotación)
    useEffect(() => {
      if (externalControl) return;

      const handleScroll = () => {
        setIsInteracting(true);
        if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);

        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollProgress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
        setRotation(scrollProgress * 360);

        interactionTimeoutRef.current = setTimeout(() => setIsInteracting(false), 150);
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", handleScroll);
        if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      };
    }, [externalControl]);

    // Auto-rotación cuando no hay scroll ni swipe activo
    useEffect(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      const autoRotate = () => {
        if (!isInteracting) {
          setRotation((prev) => prev + autoRotateSpeed);
        }
        animationFrameRef.current = requestAnimationFrame(autoRotate);
      };

      animationFrameRef.current = requestAnimationFrame(autoRotate);
      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
    }, [isInteracting, autoRotateSpeed]);

    // Swipe táctil para rotar el carrusel en celular
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      setIsInteracting(true);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      touchStartXRef.current = e.touches[0].clientX;
      touchStartRotationRef.current = rotation;
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartXRef.current === null) return;
      const deltaX = e.touches[0].clientX - touchStartXRef.current;
      setRotation(touchStartRotationRef.current + deltaX * 0.5);
    };

    const handleTouchEnd = () => {
      touchStartXRef.current = null;
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = setTimeout(() => setIsInteracting(false), 1200);
    };

    // API imperativa para control externo (wheel, drag, swipe en BookingPage)
    const addRotation = useCallback((delta: number) => {
      setRotation((prev) => prev + delta);
    }, []);

    const setInteracting = useCallback((value: boolean) => {
      setIsInteracting(value);
    }, []);

    useImperativeHandle(ref, () => ({ addRotation, setInteracting }), [addRotation, setInteracting]);

    const anglePerItem = items.length > 0 ? 360 / items.length : 0;

    return (
      <div
        role="region"
        aria-label="Galería circular 3D"
        className={cn("relative w-full h-full flex items-center justify-center", className)}
        style={{ perspective: "2000px", touchAction: "pan-y" }}
        onTouchStart={externalControl ? undefined : handleTouchStart}
        onTouchMove={externalControl ? undefined : handleTouchMove}
        onTouchEnd={externalControl ? undefined : handleTouchEnd}
        {...props}
      >
        <div
          className="relative w-full h-full"
          style={{
            transform: `rotateY(${rotation}deg)`,
            transformStyle: "preserve-3d",
            willChange: "transform",
          }}
        >
          {items.map((item, i) => {
            const itemAngle = i * anglePerItem;
            const totalRotation = rotation % 360;
            const relativeAngle = (itemAngle + totalRotation + 360) % 360;
            const normalizedAngle = Math.abs(relativeAngle > 180 ? 360 - relativeAngle : relativeAngle);
            const opacity = Math.max(0.3, 1 - normalizedAngle / 180);
            const isSelected = selectedIndex === i;
            // z-index explícito según profundidad: sin esto, el hit-testing de clics
            // usa el orden del DOM (no la posición 3D real) y solo una tarjeta es clickeable
            const zIndex = Math.round((180 - normalizedAngle) * 10);

            return (
              <div
                key={`${item.photo.text}-${i}`}
                role="group"
                aria-label={item.common}
                className="absolute"
                style={{
                  width: card.width,
                  height: card.height,
                  transform: `rotateY(${itemAngle}deg) translateZ(${radius}px)`,
                  left: "50%",
                  top: "50%",
                  marginLeft: card.marginLeft,
                  marginTop: card.marginTop,
                  opacity,
                  zIndex,
                  transition: "opacity 0.3s linear",
                }}
              >
                <button
                  type="button"
                  onClick={() => onItemClick?.(item, i)}
                  className="group relative w-full h-full overflow-hidden text-left"
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: isSelected
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-glass-border)",
                    background: "var(--color-glass-surface)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: isSelected
                      ? "0 0 0 4px color-mix(in srgb, var(--color-primary) 25%, transparent), 0 16px 40px rgba(0,0,0,0.4)"
                      : "0 16px 40px rgba(0,0,0,0.4)",
                    cursor: onItemClick ? "pointer" : "default",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  <img
                    src={item.photo.url}
                    alt={item.photo.text}
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, objectPosition: item.photo.pos || "center" }}
                  />
                  <div
                    className="absolute flex flex-col"
                    style={{ bottom: -1, left: -1, right: -1 }}
                  >
                    <div
                      style={{
                        height: fadeHeight,
                        background: "linear-gradient(to top, #1a1a1a 0%, transparent 100%)",
                      }}
                    />
                    <div
                      className="flex flex-col"
                      style={{ background: "#1a1a1a", padding: footerPadding, gap: card.width < 220 ? 3 : 6 }}
                    >
                      <h3
                        className={cn("font-bold leading-tight", titleSizeClass)}
                        style={{ color: "#ffffff", margin: 0, letterSpacing: "-0.01em" }}
                      >
                        {item.common}
                      </h3>
                      <span
                        className="font-semibold rounded-full text-center leading-snug"
                        style={{
                          color: "var(--color-primary)",
                          background: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
                          padding: "4px 12px",
                          fontSize: subtitleFontSize,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.binomial}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

CircularGallery.displayName = "CircularGallery";

export { CircularGallery };