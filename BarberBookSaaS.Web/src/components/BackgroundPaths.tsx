const PATH_COUNT = 36;

interface FloatingPathsProps {
  position: number;
}

export function FloatingPaths({ position }: FloatingPathsProps) {
  const paths = Array.from({ length: PATH_COUNT }, (_, i) => {
    const step = i * 1.8;
    return {
      id: i,
      d: `M-${380 - step * 5 * position} -${189 + step * 6}C-${
        380 - step * 5 * position
      } -${189 + step * 6} -${312 - step * 5 * position} ${216 - step * 6} ${
        152 - step * 5 * position
      } ${343 - step * 6}C${616 - step * 5 * position} ${470 - step * 6} ${
        684 - step * 5 * position
      } ${875 - step * 6} ${684 - step * 5 * position} ${875 - step * 6}`,
      width: 0.5 + i * 0.04,
      strokeOpacity: 0.06 + i * 0.022,
      delay: -(i * 1.3),
      duration: 18 + (i % 7) * 2,
    };
  });

  return (
    <div className="absolute pointer-events-none" style={{ top: 0, right: 0, bottom: 0, left: 0, contain: "strict", willChange: "transform" }} aria-hidden="true">
      <svg
        className="h-full w-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <title>Fondo decorativo animado</title>
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            stroke="#9CA3AF"
            strokeWidth={path.width}
            strokeOpacity={path.strokeOpacity}
            strokeDasharray="800 1200"
            className="landing-path-anim"
            style={{
              animationDuration: `${path.duration}s`,
              animationDelay: `${path.delay}s`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

export function BackgroundPaths() {
  return (
    <div className="absolute pointer-events-none overflow-hidden" style={{ top: 0, right: 0, bottom: 0, left: 0 }} aria-hidden="true">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}
