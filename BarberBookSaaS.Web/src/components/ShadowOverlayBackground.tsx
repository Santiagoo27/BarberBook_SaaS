import { useEffect, useId } from "react";

interface ShadowOverlayBackgroundProps {
  primaryColor?: string;
  secondaryColor?: string;
  themeMode?: "light" | "dark";
  className?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(hex: string, a: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
// Complementary-ish second accent: swap R and B channels
function accent2(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `#${[b, g, r].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function ShadowOverlayBackground({
  primaryColor = "#31a1c5",
  secondaryColor,
  themeMode = "dark",
  className = "",
}: ShadowOverlayBackgroundProps) {
  const uid = useId().replace(/:/g, "");
  const isDark = themeMode === "dark";
  const acc2 = secondaryColor || accent2(primaryColor);

  const bgColor = isDark ? "var(--color-sidebar)" : "#f0f8fc";

  // Static base gradient (always visible, no animation needed)
  const baseGradient = [
    `radial-gradient(circle at 18% 22%, ${rgba(primaryColor, isDark ? 0.55 : 0.40)} 0%, transparent 38%)`,
    `radial-gradient(circle at 78% 65%, ${rgba(acc2,         isDark ? 0.40 : 0.28)} 0%, transparent 32%)`,
    `radial-gradient(circle at 72% 12%, ${rgba(primaryColor, isDark ? 0.28 : 0.20)} 0%, transparent 28%)`,
    `radial-gradient(circle at 12% 78%, ${rgba(acc2,         isDark ? 0.22 : 0.16)} 0%, transparent 24%)`,
  ].join(", ");

  // Inject keyframes
  useEffect(() => {
    const styleId = `sob-kf-${uid}`;
    if (document.getElementById(styleId)) return;
    const el = document.createElement("style");
    el.id = styleId;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.textContent = prefersReduced ? "" : `
      @keyframes sob-shift-a-${uid} {
        0%,100% { transform: scale(1) translate(0,0); opacity:1; }
        33%      { transform: scale(1.15) translate(4%, 6%); opacity:0.85; }
        66%      { transform: scale(0.9) translate(-3%, -4%); opacity:0.95; }
      }
      @keyframes sob-shift-b-${uid} {
        0%,100% { transform: scale(1) translate(0,0); opacity:1; }
        40%      { transform: scale(1.2) translate(-6%, 3%); opacity:0.8; }
        80%      { transform: scale(0.95) translate(5%, -6%); opacity:0.9; }
      }
      @keyframes sob-shift-c-${uid} {
        0%,100% { transform: scale(1) translate(0,0); }
        50%      { transform: scale(1.1) translate(-4%, 8%); }
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, [uid]);

  const prefersReduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const animA = prefersReduced ? undefined : `sob-shift-a-${uid} 18s ease-in-out infinite`;
  const animB = prefersReduced ? undefined : `sob-shift-b-${uid} 22s ease-in-out -7s infinite`;
  const animC = prefersReduced ? undefined : `sob-shift-c-${uid} 26s ease-in-out -13s infinite`;

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundColor: bgColor,
        backgroundImage: baseGradient,
      }}
    >
      {/* Animated overlay blobs */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle at 45% 55%, ${rgba(primaryColor, isDark ? 0.30 : 0.20)} 0%, transparent 35%)`,
        animation: animA,
        willChange: prefersReduced ? undefined : "transform",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle at 60% 30%, ${rgba(acc2, isDark ? 0.22 : 0.15)} 0%, transparent 30%)`,
        animation: animB,
        willChange: prefersReduced ? undefined : "transform",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `radial-gradient(circle at 25% 50%, ${rgba(acc2, isDark ? 0.18 : 0.12)} 0%, transparent 28%)`,
        animation: animC,
        willChange: prefersReduced ? undefined : "transform",
      }} />

      {/* Vignette */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: isDark
          ? "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 38%, rgba(0,0,0,0.6) 100%)"
          : "radial-gradient(ellipse 85% 75% at 50% 50%, transparent 38%, rgba(240,248,252,0.65) 100%)",
      }} />

      {/* Grain */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`,
        backgroundSize: "160px",
        opacity: isDark ? 0.55 : 0.35,
        mixBlendMode: isDark ? "overlay" : "multiply",
      }} />
    </div>
  );
}