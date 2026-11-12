import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";

interface BackgroundGradientAnimationProps {
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  size?: string;
  blendingValue?: string;
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  interactive?: boolean;
}

/**
 * Fondo animado de gradientes orbitales en tonos negro/gris/plateado.
 * Se ubica como capa absoluta (`inset: 0`) dentro de un contenedor `position: relative`.
 */
export function BackgroundGradientAnimation({
  gradientBackgroundStart = "rgb(10, 10, 10)",
  gradientBackgroundEnd = "rgb(26, 26, 28)",
  firstColor = "156, 163, 175",
  secondColor = "203, 210, 217",
  thirdColor = "107, 114, 128",
  fourthColor = "229, 231, 235",
  fifthColor = "75, 85, 99",
  pointerColor = "212, 212, 216",
  size = "70%",
  blendingValue = "soft-light",
  children,
  className,
  containerClassName,
  interactive = false,
}: BackgroundGradientAnimationProps) {
  const filterId = useId().replace(/:/g, "");
  const interactiveRef = useRef<HTMLDivElement>(null);
  const cursor = useRef({ curX: 0, curY: 0, tgX: 0, tgY: 0 });
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!interactive) return;
    let frame: number;
    const animate = () => {
      const c = cursor.current;
      c.curX += (c.tgX - c.curX) / 20;
      c.curY += (c.tgY - c.curY) / 20;
      if (interactiveRef.current) {
        interactiveRef.current.style.transform = `translate(${Math.round(c.curX)}px, ${Math.round(c.curY)}px)`;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [interactive]);

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    cursor.current.tgX = event.clientX - rect.left;
    cursor.current.tgY = event.clientY - rect.top;
  };

  const cssVars = {
    "--gradient-background-start": gradientBackgroundStart,
    "--gradient-background-end": gradientBackgroundEnd,
    "--first-color": firstColor,
    "--second-color": secondColor,
    "--third-color": thirdColor,
    "--fourth-color": fourthColor,
    "--fifth-color": fifthColor,
    "--pointer-color": pointerColor,
    "--gradient-size": size,
    "--gradient-blending": blendingValue,
  } as CSSProperties;

  return (
    <div
      className={["gradient-bg", containerClassName].filter(Boolean).join(" ")}
      style={cssVars}
      onMouseMove={interactive ? handleMouseMove : undefined}
      aria-hidden="true"
    >
      <svg className="gradient-bg-defs">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div
        className="gradient-bg-blobs"
        style={{ filter: isSafari ? "blur(40px)" : `url(#${filterId}) blur(40px)`, contain: "strict", willChange: "transform" }}
      >
        <div className="gradient-blob gradient-blob-first" />
        <div className="gradient-blob gradient-blob-second" />
        <div className="gradient-blob gradient-blob-third" />
        <div className="gradient-blob gradient-blob-fourth" />
        <div className="gradient-blob gradient-blob-fifth" />
        {interactive && <div ref={interactiveRef} className="gradient-blob gradient-blob-pointer" />}
      </div>

      {children && (
        <div className={["gradient-bg-content", className].filter(Boolean).join(" ")}>{children}</div>
      )}
    </div>
  );
}