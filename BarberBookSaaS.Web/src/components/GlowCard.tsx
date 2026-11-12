import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

/** Tarjeta con borde de resplandor plateado que sigue el cursor (ver reglas `[data-glow]` en index.css). */
export function GlowCard({ children, className = "" }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      ref.current?.style.setProperty("--x", e.clientX.toFixed(2));
      ref.current?.style.setProperty("--y", e.clientY.toFixed(2));
    };
    document.addEventListener("pointermove", handlePointerMove);
    return () => document.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div ref={ref} data-glow className={className}>
      {children}
    </div>
  );
}