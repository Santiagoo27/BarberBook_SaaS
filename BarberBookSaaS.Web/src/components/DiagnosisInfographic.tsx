import React from "react";
import type { DiagnosisResult } from "../features/barbers/aiDiagnosisService";

export type { DiagnosisResult };

interface Props {
  data: DiagnosisResult;
  clientPhotoUrl: string | null;
  containerRef?: React.Ref<HTMLDivElement>;
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 10px" }}>
    {children}
  </p>
);

const Divider = () => (
  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
);

export const DiagnosisInfographic: React.FC<Props> = ({ data, clientPhotoUrl, containerRef }) => {
  const today = new Date().toLocaleDateString("es-ES", {
    year: "numeric", month: "long", day: "numeric",
  });

  const faceRows = [
    { label: "Forma", value: data.face?.shape },
    { label: "Cabello", value: data.face?.hair_current },
    { label: "Tono de piel", value: data.face?.skin_tone },
    { label: "Frente", value: data.face?.forehead },
    { label: "Pómulos", value: data.face?.cheekbones },
    { label: "Mandíbula", value: data.face?.jawline },
  ].filter(r => r.value);

  return (
    <div
      ref={containerRef}
      className="fade-up"
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "24px 20px",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
          border: "2px solid var(--color-primary)", background: "rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {clientPhotoUrl
            ? <img src={clientPhotoUrl} alt="Cliente" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 24, lineHeight: 1 }}>👤</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ color: "#ffffff", fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            Análisis de Imagen Personal
          </h2>
          <p style={{ color: "rgba(255,255,255,0.30)", fontSize: 11, margin: "3px 0 0" }}>{today}</p>
          {data.face?.overall && (
            <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, margin: "4px 0 0", fontStyle: "italic", lineHeight: 1.4 }}>
              {data.face.overall}
            </p>
          )}
        </div>
      </div>

      <Divider />

      {/* Face analysis grid */}
      {faceRows.length > 0 && (
        <div>
          <SectionLabel>Análisis del rostro</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 10px" }}>
            {faceRows.map(({ label, value }) => (
              <div key={label} style={{
                padding: "7px 10px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", margin: "0 0 3px" }}>
                  {label}
                </p>
                <p style={{ color: "#ffffff", fontSize: 11, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Divider />

      {/* Recommended styles */}
      {data.styles?.length > 0 && (
        <div>
          <p style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, margin: "0 0 11px" }}>✂ Cortes Recomendados</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {data.styles.slice(0, 4).map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                <span style={{
                  color: "var(--color-primary)", fontSize: 10, fontWeight: 800,
                  minWidth: 20, height: 20, borderRadius: 5,
                  background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  {i + 1}
                </span>
                <div>
                  <p style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, margin: 0 }}>{s.name}</p>
                  <p style={{ color: "rgba(255,255,255,0.40)", fontSize: 11, margin: "2px 0 0", lineHeight: 1.4 }}>{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why works */}
      {data.whyWorks?.length > 0 && (
        <>
          <Divider />
          <div>
            <SectionLabel>¿Por qué estos cortes te favorecen?</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.whyWorks.map((reason, i) => (
                <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <span style={{ color: "#10b981", flexShrink: 0, fontSize: 12, lineHeight: "1.5" }}>✓</span>
                  <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, margin: 0, lineHeight: 1.4 }}>{reason}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Products */}
      {data.products?.length > 0 && (
        <>
          <Divider />
          <div>
            <SectionLabel>Productos recomendados</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.products.map((p, i) => (
                <div key={i} style={{
                  padding: "9px 11px", borderRadius: 9,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <p style={{ color: "var(--color-primary)", fontSize: 12, fontWeight: 700, margin: "0 0 2px" }}>{p.name}</p>
                  <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, margin: 0, lineHeight: 1.4 }}>{p.benefit}</p>
                  {p.how_to_use && (
                    <p style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, margin: "3px 0 0", fontStyle: "italic" }}>
                      ↳ {p.how_to_use}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Divider />

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        {data.maintenance && (
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 11, margin: 0 }}>
            ⏱ {data.maintenance}
          </p>
        )}
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 10, margin: 0 }}>
          Basado en evidencia tricológica · BarberBook Premium
        </p>
      </div>
    </div>
  );
};
