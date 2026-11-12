import { useEffect, useRef } from "react";
import { motion } from "motion/react";

interface Beam {
  x: number; y: number;
  width: number; length: number;
  angle: number; speed: number;
  opacity: number; hue: number;
  pulse: number; pulseSpeed: number;
}

function makeBeam(w: number, h: number): Beam {
  return {
    x: Math.random() * w * 1.5 - w * 0.25,
    y: Math.random() * h * 1.5 - h * 0.25,
    width: 30 + Math.random() * 60,
    length: h * 2.5,
    angle: -35 + Math.random() * 10,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: 190 + Math.random() * 70,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  };
}

const TOTAL_BEAMS = 30;

/**
 * Drop inside any `position: relative` container.
 * Renders a canvas + overlay, both `position: absolute; inset: 0`.
 * Siblings rendered after this will naturally stack above it.
 */
export function BeamsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0;

    function resize() {
      const rect = parent!.getBoundingClientRect();
      w = rect.width || window.innerWidth;
      h = rect.height || window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width  = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width  = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      beamsRef.current = Array.from({ length: TOTAL_BEAMS }, () => makeBeam(w, h));
    }

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();

    if (prefersReduced) return () => ro.disconnect();

    function resetBeam(beam: Beam, index: number) {
      const col     = index % 3;
      const spacing = w / 3;
      beam.y       = h + 100;
      beam.x       = col * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width   = 100 + Math.random() * 100;
      beam.speed   = 0.5 + Math.random() * 0.4;
      beam.hue     = 190 + (index * 70) / TOTAL_BEAMS;
      beam.opacity = 0.2 + Math.random() * 0.1;
    }

    function drawBeam(beam: Beam) {
      ctx!.save();
      ctx!.translate(beam.x, beam.y);
      ctx!.rotate((beam.angle * Math.PI) / 180);

      const alpha = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2);
      const g = ctx!.createLinearGradient(0, 0, 0, beam.length);
      g.addColorStop(0,   `hsla(${beam.hue},85%,65%,0)`);
      g.addColorStop(0.1, `hsla(${beam.hue},85%,65%,${alpha * 0.5})`);
      g.addColorStop(0.4, `hsla(${beam.hue},85%,65%,${alpha})`);
      g.addColorStop(0.6, `hsla(${beam.hue},85%,65%,${alpha})`);
      g.addColorStop(0.9, `hsla(${beam.hue},85%,65%,${alpha * 0.5})`);
      g.addColorStop(1,   `hsla(${beam.hue},85%,65%,0)`);
      ctx!.fillStyle = g;
      ctx!.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      ctx!.restore();
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.filter = "blur(35px)";

      beamsRef.current.forEach((beam, i) => {
        beam.y     -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -100) resetBeam(beam, i);
        drawBeam(beam);
      });

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: "absolute", inset: 0,
          filter: "blur(15px)", pointerEvents: "none",
        }}
      />
      <motion.div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundColor: "rgba(8,8,12,0.06)",
          backdropFilter: "blur(50px)",
        }}
        animate={{ opacity: [0.08, 0.2, 0.08] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
      />
    </>
  );
}