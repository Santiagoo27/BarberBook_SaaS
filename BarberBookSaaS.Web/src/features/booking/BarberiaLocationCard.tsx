import React, { useState } from "react";

interface BarberiaLocationCardProps {
  address: string;
  tenantName: string;
}

export const BarberiaLocationCard: React.FC<BarberiaLocationCardProps> = ({ address, tenantName }) => {
  const [hovered, setHovered] = useState(false);

  const encoded = encodeURIComponent(address);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const embedUrl = `https://maps.google.com/maps?q=${encoded}&output=embed`;

  const handleClick = () => {
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        cursor: "pointer",
        transition: "box-shadow 200ms ease, transform 150ms ease",
        boxShadow: hovered
          ? "0 4px 20px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)"
          : "none",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      {/* Map preview with overlay to capture all clicks */}
      <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
        <iframe
          src={embedUrl}
          title={`Mapa de ${tenantName}`}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {/* Transparent overlay to route all clicks to the parent handler */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
      </div>

      {/* Info bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderTop: "1px solid var(--color-border)",
      }}>
        {/* MapPin icon */}
        <div style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-text)",
            margin: 0,
            marginBottom: 2,
            lineHeight: 1.3,
          }}>
            Cómo llegar
          </p>
          <p style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}>
            {address}
          </p>
        </div>

        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, opacity: 0.6 }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
};
