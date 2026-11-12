import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { appointmentService } from "../appointments/appointmentService";
import type { Appointment } from "../appointments/appointmentTypes";
import { aiDiagnosisService, AI_SERVICE_NAME, type DiagnosisResult, type AiDiagnosisQuota } from "./aiDiagnosisService";
import { DiagnosisInfographic } from "../../components/DiagnosisInfographic";
import { Check, X, Sparkles, Download, CalendarDays, Camera, Scissors, Share2, Image as ImageIcon, UserPlus } from "lucide-react";
import { brandingService } from "../branding/brandingService";
import { serviceService } from "../services/serviceService";
import type { Service } from "../services/serviceTypes";
import { useTheme } from "../../context/ThemeContext";
const loadToJpeg = () => import("html-to-image").then(m => m.toJpeg);

/* ── Status tokens ─────────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  Pendiente:  { bg: "rgba(245,158,11,0.10)",  text: "#f59e0b", dot: "#f59e0b", border: "rgba(245,158,11,0.30)" },
  Completada: { bg: "rgba(16,185,129,0.10)",  text: "#34d399", dot: "#10b981", border: "rgba(16,185,129,0.30)" },
  Cancelada:  { bg: "rgba(239,68,68,0.10)",   text: "#f87171", dot: "#ef4444", border: "rgba(239,68,68,0.30)" },
};

/* ── Avatar palette ─────────────────────────────────────────── */
const AVATARS = [
  { bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)", color: "var(--color-primary)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)" },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b" },
];

/* ── Portal constants ──────────────────────────────────────── */
const PANEL: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)", borderRadius: "20px",
};

/* ── DiagnosisModal ─────────────────────────────────────────── */
interface DiagnosisModalProps { appointment: Appointment; onClose: () => void; }

const DiagnosisModal: React.FC<DiagnosisModalProps> = ({ appointment, onClose }) => {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [result, setResult]       = useState<DiagnosisResult | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [quota, setQuota]           = useState<AiDiagnosisQuota | null>(null);
  const { primaryColor } = useTheme();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const diagnosisContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    brandingService.getBranding()
      .then(b => { if (b.logoBase64) setLogoBase64(b.logoBase64); })
      .catch(() => {});
    aiDiagnosisService.getExisting(appointment.id)
      .then(existing => {
        if (existing) {
          setResult(existing);
          const saved = sessionStorage.getItem(`diagnosis-photo-${appointment.id}`);
          if (saved) setPreview(saved);
        }
      })
      .finally(() => setLoadingExisting(false));
    aiDiagnosisService.getQuota()
      .then(q => { if (q) setQuota(q); })
      .catch(() => {});
  }, [appointment.id]);

  const showQuotaBanner =
    !result &&
    quota !== null &&
    quota.limit !== -1 &&
    quota.remaining <= 20;

  const handleFile = (f: File) => {
    setFile(f); setError(null); setImageLoaded(false);
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result as string); setShowConfirm(true); };
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (quota?.remaining === 0) return;
    setShowConfirm(false);
    setLoading(true); setError(null); setImageLoaded(false);

    const messages = ["Analizando imagen...", "Generando cortes recomendados...", "Casi listo, esto puede tomar hasta un minuto..."];
    setLoadingMsg(messages[0]);
    const t1 = setTimeout(() => setLoadingMsg(messages[1]), 8_000);
    const t2 = setTimeout(() => setLoadingMsg(messages[2]), 25_000);

    const attempt = async (): Promise<DiagnosisResult> => {
      try { return await aiDiagnosisService.diagnose(appointment.id, file); }
      catch (err: unknown) {
        const axiosErr = err as { code?: string; response?: { data?: { message?: string }; status?: number } };
        const isTimeout = axiosErr.code === "ECONNABORTED" || axiosErr.code === "ERR_NETWORK";
        if (isTimeout) {
          setLoadingMsg("Reintentando...");
          return await aiDiagnosisService.diagnose(appointment.id, file);
        }
        throw err;
      }
    };

    try {
      setResult(await attempt());
      setQuota(q => q && q.limit !== -1
        ? { ...q, remaining: Math.max(0, q.remaining - 1), used: q.used + 1 }
        : q);
      if (preview) {
        try {
          const img = new Image();
          img.src = preview;
          await new Promise<void>(r => { img.onload = () => r(); if (img.complete) r(); });
          const c = document.createElement("canvas");
          c.width = 200; c.height = 200;
          c.getContext("2d")!.drawImage(img, 0, 0, 200, 200);
          sessionStorage.setItem(`diagnosis-photo-${appointment.id}`, c.toDataURL("image/jpeg", 0.8));
        } catch { /* non-critical */ }
      }
    }
    catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message ?? "Error al analizar la imagen. Intenta de nuevo.";
      setError(msg);
    }
    finally { clearTimeout(t1); clearTimeout(t2); setLoading(false); }
  };

  const captureAsDesktop = async () => {
    const el = diagnosisContainerRef.current!;
    const parent = el.parentElement!;
    const savedEl = { width: el.style.width, minWidth: el.style.minWidth };
    const savedParent = { width: parent.style.width, minWidth: parent.style.minWidth, overflow: parent.style.overflow };

    el.classList.add("diagnosis-export-mode");
    Object.assign(el.style, { width: "600px", minWidth: "600px" });
    Object.assign(parent.style, { width: "600px", minWidth: "600px", overflow: "visible" });

    const avatarImg = el.querySelector('img[alt="Cliente"]') as HTMLImageElement | null;
    const avatarParent = avatarImg?.parentElement ?? null;
    let avatarCanvas: HTMLCanvasElement | null = null;
    if (avatarImg && avatarParent && avatarImg.naturalWidth > 0) {
      avatarCanvas = document.createElement("canvas");
      avatarCanvas.width = 112; avatarCanvas.height = 112;
      avatarCanvas.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%";
      avatarCanvas.getContext("2d")!.drawImage(avatarImg, 0, 0, 112, 112);
      avatarParent.replaceChild(avatarCanvas, avatarImg);
    }

    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    try {
      return await (await loadToJpeg())(el, { quality: 0.95, backgroundColor: "#0a0a0a", pixelRatio: 2 });
    } finally {
      if (avatarCanvas && avatarParent && avatarImg) avatarParent.replaceChild(avatarImg, avatarCanvas);
      Object.assign(el.style, savedEl);
      Object.assign(parent.style, savedParent);
      el.classList.remove("diagnosis-export-mode");
    }
  };

  const handleDownload = async () => {
    if (!diagnosisContainerRef.current) return;
    try {
      const dataUrl = await captureAsDesktop();
      const link = document.createElement("a");
      link.download = `diagnostico-${appointment.customerName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error("Error al descargar:", err); }
  };

  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const handleShareWhatsApp = async () => {
    if (!diagnosisContainerRef.current) return;
    try {
      const dataUrl = await captureAsDesktop();
      const blob = await (await fetch(dataUrl)).blob();

      const phone = appointment.customerPhone?.replace(/\D/g, "") ?? "";
      const normalizedPhone = phone.length === 10 && phone.startsWith("3") ? `57${phone}` : phone;

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setShareMsg("✓ Imagen copiada. Pégala en el chat (Ctrl+V)");
      } catch {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `diagnostico-${appointment.customerName.replace(/\s+/g, "-").toLowerCase()}.jpg`;
        link.click();
        setShareMsg("✓ Imagen descargada. Adjúntala en el chat");
      }

      setTimeout(() => setShareMsg(null), 5000);
      window.open(`https://wa.me/${normalizedPhone}`, "_blank");
    } catch (err) { console.error("Error al compartir:", err); }
  };

  const handleDownloadPDF = async () => {
    if (!diagnosisContainerRef.current) return;
    try {
      const dataUrl = await captureAsDesktop();
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: img.width > img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width / 2, img.height / 2],
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, img.width / 2, img.height / 2);
      pdf.save(`diagnostico-${appointment.customerName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) { console.error("Error al generar PDF:", err); }
  };

  return createPortal(
    <div
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.80)", zIndex: 9999, overflowY: "auto", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ display: "flex", minHeight: "100%", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem" }}>
        <div
          className="fade-up"
          style={{ ...PANEL, position: "relative", width: "100%", maxWidth: result ? "860px" : "480px", transition: "max-width 0.4s ease" }}
        >
          {/* Modal header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)" }}>
            <div>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Diagnóstico IA</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 3 }}>{appointment.customerName}</p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--color-glass-surface-hover)", color: "var(--color-text-muted)",
                cursor: "pointer", transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {loadingExisting && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 12 }}>Cargando diagnóstico...</p>
              </div>
            )}

            {!loadingExisting && !result && showConfirm && preview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <img src={preview} alt="Foto seleccionada" style={{ maxHeight: 220, borderRadius: 10, objectFit: "cover", margin: "0 auto", display: "block" }} />
                <div style={{ borderRadius: 10, padding: "14px 16px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
                  <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>⚠ El diagnóstico solo se puede realizar una vez</p>
                  <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>¿Estás seguro de que esta es la foto que deseas analizar? Una vez generado, no se podrá repetir para esta cita.</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setShowConfirm(false); setFile(null); setPreview(null); }}
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", cursor: "pointer" }}
                  >
                    Cambiar foto
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={loading || quota?.remaining === 0}
                    className="btn-primary"
                    style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: quota?.remaining === 0 ? 0.4 : 1, cursor: quota?.remaining === 0 ? "not-allowed" : "pointer" }}
                  >
                    {loading ? "Analizando..." : <><Sparkles size={14} /> Confirmar y analizar</>}
                  </button>
                </div>
              </div>
            )}

            {!loadingExisting && !result && !showConfirm && (
              <>
                {showQuotaBanner && !loading && (
                  <div style={{
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: quota!.remaining === 0 ? "rgba(239,68,68,0.10)" : "rgba(234,179,8,0.10)",
                    border: `1px solid ${quota!.remaining === 0 ? "rgba(239,68,68,0.30)" : "rgba(234,179,8,0.30)"}`,
                    color: quota!.remaining === 0 ? "#f87171" : "#fbbf24",
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>
                      {quota!.remaining === 0 ? "🚫" : "⚠️"}
                    </span>
                    <span>
                      {quota!.remaining === 0
                        ? "Límite mensual alcanzado"
                        : `Quedan ${quota!.remaining} diagnósticos este mes`}
                      {quota!.resetDate && (
                        <> · se reinicia el {new Date(quota!.resetDate).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</>
                      )}
                    </span>
                  </div>
                )}
                {loading ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 12, transition: "opacity 200ms ease" }}>{loadingMsg}</p>
                  </div>
                ) : (
                <>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  style={{
                    borderRadius: 14, padding: "28px 20px", textAlign: "center",
                    border: "2px dashed var(--color-border)", transition: "border-color 150ms ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
                >
                  {preview ? (
                    <img src={preview} alt="Previsualización" style={{ maxHeight: 192, borderRadius: 8, objectFit: "cover", margin: "0 auto", display: "block" }} />
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                        <Camera size={28} style={{ color: "var(--color-text-muted)" }} />
                      </div>
                      <p style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Foto del cliente</p>
                      <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginBottom: 16 }}>JPG, PNG — cara visible de frente</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={quota?.remaining === 0}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
                            color: "var(--color-primary)", cursor: quota?.remaining === 0 ? "not-allowed" : "pointer",
                            transition: "all 150ms ease",
                            opacity: quota?.remaining === 0 ? 0.4 : 1,
                          }}
                          onMouseEnter={e => { if (quota?.remaining !== 0) e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 25%, transparent)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 15%, transparent)"; }}
                        >
                          <Camera size={16} /> Tomar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          disabled={quota?.remaining === 0}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "12px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                            background: "var(--color-glass-surface)",
                            border: "1px solid var(--color-glass-border)",
                            color: "var(--color-text)", cursor: quota?.remaining === 0 ? "not-allowed" : "pointer",
                            transition: "all 150ms ease",
                            opacity: quota?.remaining === 0 ? 0.4 : 1,
                          }}
                          onMouseEnter={e => { if (quota?.remaining !== 0) e.currentTarget.style.background = "var(--color-glass-surface-hover)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--color-glass-surface)"; }}
                        >
                          <ImageIcon size={16} /> Desde galería
                        </button>
                      </div>
                    </div>
                  )}
                  <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>

                {error && (
                  <div style={{ borderRadius: 10, padding: "12px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
                    {error}
                  </div>
                )}
                </>
                )}
              </>
            )}

            {result && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div ref={diagnosisContainerRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {result.imageBase64 ? (
                    <div style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
                      {!imageLoaded && (
                        <div
                          className="skeleton-shimmer"
                          style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12 }}
                        />
                      )}
                      <img
                        src={`data:image/png;base64,${result.imageBase64}`}
                        alt="Catálogo de estilos IA"
                        style={{ width: "100%", borderRadius: 12, display: imageLoaded ? "block" : "none" }}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                      />
                      {imageLoaded && result.styles?.slice(0, 4).map((s, i) => (
                        <div key={i} style={{
                          position: "absolute",
                          bottom: i < 2 ? "50%" : 0,
                          left: i % 2 === 0 ? 0 : "50%",
                          width: "50%",
                          display: "flex", justifyContent: "center", alignItems: "flex-end",
                          paddingBottom: 12,
                        }}>
                          <span className="diagnosis-cut-label" style={{
                            background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
                            color: "white", fontSize: 13, fontWeight: 700,
                            padding: "6px 14px", borderRadius: 20,
                            border: "1px solid rgba(255,255,255,0.2)",
                            textAlign: "center", letterSpacing: "0.03em",
                            maxWidth: "90%", textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                          }}>
                            {s.name}
                          </span>
                        </div>
                      ))}
                      {imageLoaded && (
                        <div className="diagnosis-logo" style={{
                          position: "absolute", top: 12, right: 12,
                          borderRadius: "50%",
                          border: "3px solid white", background: logoBase64 ? "white" : primaryColor,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden", padding: 4,
                        }}>
                          {logoBase64 ? (
                            <img
                              src={logoBase64.startsWith("data:") ? logoBase64 : `data:image/png;base64,${logoBase64}`}
                              alt="Logo barbería"
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <Scissors size={36} color="white" />
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      borderRadius: 12, padding: "24px", textAlign: "center",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>
                        Imagen disponible solo con API de Gemini configurada
                      </p>
                    </div>
                  )}

                  <DiagnosisInfographic data={result} clientPhotoUrl={preview} />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleDownload}
                    className="btn-primary"
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Download size={14} /> Descargar JPG
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    className="btn-primary"
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Download size={14} /> Descargar PDF
                  </button>
                  {appointment.customerPhone && (
                    <button
                      onClick={handleShareWhatsApp}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#25D366", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                      <Share2 size={14} /> WhatsApp
                    </button>
                  )}
                </div>
                {shareMsg && (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#25D366", fontWeight: 600, margin: 0 }}>
                    {shareMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── WalkInModal ───────────────────────────────────────────── */
interface WalkInModalProps { onClose: () => void; onSuccess: (msg: string) => void; }

const WalkInModal: React.FC<WalkInModalProps> = ({ onClose, onSuccess }) => {
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState("");

  const now = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }, []);
  const [date, setDate] = useState(now.date);
  const [time, setTime] = useState(now.time);

  useEffect(() => {
    serviceService.getAll()
      .then(all => {
        const active = all.filter(s => s.isActive);
        setServices(active);
        if (active.length === 1) setServiceId(active[0].id);
      })
      .catch(() => setError("Error al cargar servicios."))
      .finally(() => setLoadingServices(false));
  }, []);

  const selectedService = services.find(s => s.id === serviceId);
  const isAiSelected = selectedService?.name === AI_SERVICE_NAME;

  useEffect(() => {
    if (isAiSelected) setDate(now.date);
  }, [isAiSelected, now.date]);

  const canSubmit = customerName.trim().length > 0 && serviceId && date && time && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await appointmentService.createWalkIn({
        serviceId,
        customerName: customerName.trim(),
        appointmentDate: `${date}T${time}:00`,
        customerPhone: customerPhone.trim() || undefined,
      });
      onSuccess("Cliente sin cita registrado");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message ?? "Error al registrar cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    fontSize: 14, fontWeight: 500,
    background: "var(--color-surface)", color: "var(--color-text)",
    border: "1px solid var(--color-border)", outline: "none",
    transition: "border-color 150ms ease",
    colorScheme: "dark",
  };

  return createPortal(
    <div
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: 420, padding: 0, overflow: "hidden", boxSizing: "border-box" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--color-primary)" }}>
              <UserPlus size={18} />
            </div>
            <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Cliente sin cita</h2>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-glass-surface-hover)", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 150ms ease" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Nombre */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Ej: Carlos García"
              maxLength={100}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              autoFocus
            />
          </div>

          {/* Teléfono */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Teléfono{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                (opcional · fidelización y WhatsApp)
              </span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="Ej: 3001234567"
              maxLength={20}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
              onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
            />
          </div>

          {/* Servicio */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Servicio *
            </label>
            {loadingServices ? (
              <div style={{ padding: "11px 14px", fontSize: 13, color: "var(--color-text-muted)" }}>Cargando servicios...</div>
            ) : (
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer", appearance: "auto" as React.CSSProperties["appearance"] }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              >
                <option value="">Seleccionar servicio</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ${s.price.toLocaleString()} ({s.durationMinutes} min)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha y hora */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={isAiSelected}
                style={{ ...inputStyle, boxSizing: "border-box", cursor: isAiSelected ? "not-allowed" : "pointer", opacity: isAiSelected ? 0.5 : 1 }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Hora
              </label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{ ...inputStyle, boxSizing: "border-box", cursor: "pointer" }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ borderRadius: 10, padding: "12px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary"
            style={{
              width: "100%", padding: "13px 0", borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? (
              <>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "#000", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                Registrando...
              </>
            ) : (
              <>
                <UserPlus size={16} /> Registrar
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── Helpers ───────────────────────────────────────────────── */
type View = "today" | "thisweek" | "week";

const DAY_LABELS: Record<string, string> = {
  "0": "Domingo", "1": "Lunes", "2": "Martes",
  "3": "Miércoles", "4": "Jueves", "5": "Viernes", "6": "Sábado",
};

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const formatDayHeader = (dateStr: string, todayStr: string) => {
  const d = new Date(dateStr + "T12:00:00");
  const dayName  = DAY_LABELS[String(d.getDay())];
  const formatted = `${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
  return dateStr === todayStr ? `Hoy — ${dayName} ${formatted}` : `${dayName}, ${formatted}`;
};

/* ── Main component ─────────────────────────────────────────── */
export const BarberDashboard: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [diagnosisAppt, setDiagnosisAppt] = useState<Appointment | null>(null);
  const [view, setView]                 = useState<View>("today");
  const [cancelConfirm, setCancelConfirm] = useState<Appointment | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [showWalkIn, setShowWalkIn]     = useState(false);
  const [tenantPlan, setTenantPlan]     = useState<string>("Standard");

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  }, []);

  const todayLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = view === "today"
        ? await appointmentService.getToday()
        : view === "thisweek"
        ? await appointmentService.getThisWeek()
        : await appointmentService.getWeek();
      setAppointments(data.sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()));
    } catch { setError("Error al cargar las citas."); }
    finally { setLoading(false); }
  }, [view]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    brandingService.getBranding().then(b => { if (b.plan) setTenantPlan(b.plan); }).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleStatus = (id: string, status: "Completada" | "Cancelada") => {
    const prev = appointments;
    setAppointments(cur => cur.map(a =>
      a.id === id ? { ...a, status, cancelledBy: status === "Cancelada" ? "barber" : a.cancelledBy } : a
    ));
    showToast(status === "Completada" ? "Cita completada" : "Cita cancelada");
    appointmentService.updateStatus(id, status).catch(() => {
      setAppointments(prev);
      showToast("Error al actualizar la cita");
    });
  };

  const weekGroups = useMemo(() => {
    if (view === "today") return [];
    const groups: Record<string, Appointment[]> = {};
    for (const appt of appointments) {
      const day = appt.appointmentDate.split("T")[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(appt);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments, view]);

  // Stats reflejan siempre el rango activo (hoy o 14 días)
  const stats = {
    total:     appointments.length,
    pending:   appointments.filter(a => a.status === "Pendiente").length,
    completed: appointments.filter(a => a.status === "Completada").length,
    cancelled: appointments.filter(a => a.status === "Cancelada").length,
  };


  /* ── Render appointment row ────────────────────────────── */
  const renderRow = (appt: Appointment, idx: number) => {
    const time        = appt.appointmentDate.split("T")[1]?.substring(0, 5) ?? "";
    const isPending   = appt.status === "Pendiente";
    const isCancelled = appt.status === "Cancelada";
    const isAiService = appt.service?.name === AI_SERVICE_NAME;
    const isPremiumTenant = tenantPlan === "Premium" || tenantPlan === "PremiumUnlimited";
    const canUseDiagnosis = isPremiumTenant && (isAiService || appt.isWalkIn);
    const isUpdating  = false;
    const sc = STATUS_COLORS[appt.status] ?? STATUS_COLORS["Pendiente"];
    const avatar = AVATARS[appt.customerName.charCodeAt(0) % 4];
    const cancelledByLabel = isCancelled && appt.cancelledBy
      ? appt.cancelledBy === "customer" ? "cliente"
      : appt.cancelledBy === "barber"   ? "barbero"
      : "dueño"
      : null;

    return (
      <div
        key={appt.id}
        className="barber-appt-row fade-up"
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          padding: "18px 22px",
          borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
          transition: "background 150ms ease",
          animationDelay: `${Math.min(idx * 30, 240)}ms`,
          background: isAiService ? "color-mix(in srgb, var(--color-primary) 4%, transparent)" : "transparent",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isAiService
          ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
          : "var(--color-glass-surface-hover)")}
        onMouseLeave={e => (e.currentTarget.style.background = isAiService
          ? "color-mix(in srgb, var(--color-primary) 4%, transparent)"
          : "transparent")}
      >
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700,
          background: avatar.bg, color: avatar.color,
        }}>
          {appt.customerName.charAt(0).toUpperCase()}
        </div>

        {/* Customer info */}
        <div className="barber-appt-info" style={{ flex: "0 0 165px", minWidth: 0 }}>
          <p style={{ color: "var(--color-text)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}>
            {appt.customerName}
            {appt.isWalkIn && (
              <span style={{
                fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "5px",
                background: "rgba(168,85,247,0.12)", color: "#a855f7",
                border: "1px solid rgba(168,85,247,0.25)", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                Sin cita
              </span>
            )}
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {appt.customerPhone || "Sin teléfono"}
          </p>
          {appt.customerLoyaltyEnabled && appt.customerLoyaltyCount != null && appt.customerLoyaltyThreshold != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <div style={{
                flex: 1, height: 4, borderRadius: 2, maxWidth: 60,
                background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: appt.customerLoyaltyCount >= appt.customerLoyaltyThreshold ? "#10b981" : "var(--color-primary)",
                  width: `${Math.min(100, Math.round((appt.customerLoyaltyCount / appt.customerLoyaltyThreshold) * 100))}%`,
                }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                color: appt.customerLoyaltyCount >= appt.customerLoyaltyThreshold ? "#10b981" : "var(--color-text-muted)",
              }}>
                {appt.customerLoyaltyCount >= appt.customerLoyaltyThreshold
                  ? "Corte gratis"
                  : `${appt.customerLoyaltyCount}/${appt.customerLoyaltyThreshold}`
                }
              </span>
            </div>
          )}
          {/* Servicio debajo del teléfono — solo celular */}
          <p className="barber-appt-service-mobile" style={{
            fontSize: 12, marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: isAiService ? "var(--color-primary)" : "var(--color-text-muted)",
            fontWeight: isAiService ? 700 : 500,
          }}>
            {appt.service?.name}
            {cancelledByLabel && ` · Cancelada por ${cancelledByLabel}`}
          </p>
        </div>

        {/* Meta: service + time + status + actions — segunda línea en celular */}
        <div className="barber-appt-meta" style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>

          {/* Service — solo escritorio */}
          <div className="barber-appt-service-desktop" style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isAiService
                ? <><span style={{ color: "var(--color-primary)", fontWeight: 700 }}>{appt.service?.name}</span> <Sparkles size={11} style={{ display: "inline", verticalAlign: "middle", color: "var(--color-primary)" }} /></>
                : <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{appt.service?.name}</span>
              }
            </p>
            {cancelledByLabel && (
              <p style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginTop: 2 }}>
                Cancelada por {cancelledByLabel}
              </p>
            )}
          </div>

          {/* Time */}
          <span style={{ color: sc.text, fontWeight: 700, fontSize: 14, flexShrink: 0, fontVariantNumeric: "tabular-nums", fontFamily: "monospace", minWidth: 40 }}>
            {time}
          </span>

          {/* Status pill */}
          <span
            className={isPending ? "badge-pending-pulse" : ""}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap",
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, flexShrink: 0, display: "block" }} />
            {appt.status}
          </span>

          {/* Actions */}
          {isPending && (
            <div className="barber-appt-actions" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {canUseDiagnosis && (
                <button
                  onClick={() => setDiagnosisAppt(appt)}
                  className="btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <Sparkles size={11} /> IA
                </button>
              )}
              <button
                disabled={isUpdating}
                onClick={() => handleStatus(appt.id, "Completada")}
                title="Completar cita"
                className="barber-action-btn"
                style={{
                  minWidth: 32, height: 32, borderRadius: 8, border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  cursor: isUpdating ? "not-allowed" : "pointer", flexShrink: 0,
                  background: "rgba(16,185,129,0.12)", color: "#10b981",
                  fontSize: 11, fontWeight: 600,
                  transition: "background 150ms ease", opacity: isUpdating ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!isUpdating) e.currentTarget.style.background = "rgba(16,185,129,0.24)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}
              >
                <Check size={13} />
                <span className="barber-action-label">Completar</span>
              </button>
              <button
                disabled={isUpdating}
                onClick={() => setCancelConfirm(appt)}
                title="Cancelar cita"
                className="barber-action-btn"
                style={{
                  minWidth: 32, height: 32, borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  cursor: isUpdating ? "not-allowed" : "pointer", flexShrink: 0,
                  background: "transparent", color: "var(--color-text-muted)",
                  fontSize: 11, fontWeight: 600,
                  border: "1px solid var(--color-border)", transition: "all 150ms ease",
                  opacity: isUpdating ? 0.5 : 1,
                }}
                onMouseEnter={e => { if (!isUpdating) { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; } }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}
              >
                <X size={13} />
                <span className="barber-action-label">Cancelar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Empty state ────────────────────────────────────────── */
  const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div
      className="fade-up"
      style={{
        borderRadius: 20, padding: "64px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
        background: "var(--color-glass-surface)", border: "1px dashed var(--color-glass-border)",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14, marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
        color: "var(--color-primary)",
      }}>
        <CalendarDays size={20} />
      </div>
      <p style={{ color: "var(--color-text)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
        Sin citas
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, maxWidth: 280 }}>
        {message}
      </p>
    </div>
  );

  /* ── Appointments container ─────────────────────────────── */
  const AppointmentList: React.FC<{ appts: Appointment[] }> = ({ appts }) => (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      background: "var(--color-glass-surface)",
      border: "1px solid var(--color-glass-border)",
    }}>
      {appts.map((appt, idx) => renderRow(appt, idx))}
    </div>
  );

  return (
    <div className="fade-up dashboard-mobile-compact" style={{ maxWidth: "920px", display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{
            color: "var(--color-text)", fontSize: 30, fontWeight: 800,
            letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "Inter, sans-serif",
          }}>
            Mis Citas
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, fontWeight: 500, marginTop: 5, textTransform: "capitalize" }}>
            {todayLabel}
          </p>
        </div>

        <div className="barber-header-controls" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Cliente sin cita */}
        <button
          onClick={() => setShowWalkIn(true)}
          className="btn-primary"
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: 10,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <UserPlus size={15} /> Sin cita
        </button>

        {/* View toggle */}
        <div style={{
          display: "inline-flex", gap: "2px", padding: "3px", borderRadius: "10px",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
        }}>
          {(["today", "thisweek", "week"] as View[]).map(v => {
            const isActive = view === v;
            const label = v === "today" ? "Hoy" : v === "thisweek" ? "Esta semana" : "2 semanas";
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "5px 14px", borderRadius: 7,
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: "none", transition: "all 150ms ease",
                  background: isActive
                    ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                    : "transparent",
                  color: isActive ? "#000" : "var(--color-text-muted)",
                  boxShadow: isActive ? "0 2px 8px color-mix(in srgb, var(--color-primary) 38%, transparent)" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {error && (
        <div style={{ borderRadius: 10, padding: "12px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* ── Stat cards ──────────────────────────────────────── */}
      {loading ? (
        <div className="stat-grid">
          {[0,1,2,3].map(i => (
            <div key={i} className="skeleton-shimmer fade-up" style={{ height: 100, borderRadius: 16, animationDelay: `${i * 55}ms` }} />
          ))}
        </div>
      ) : (
        <div className="stat-grid">
          {[
            { label: view === "today" ? "Total hoy" : view === "thisweek" ? "Total semana" : "Total 2 sem.", value: stats.total, variant: "stat-card-primary", color: "var(--color-primary)" },
            { label: "Pendientes",  value: stats.pending,   variant: "stat-card-amber",   color: "#f59e0b" },
            { label: "Completadas", value: stats.completed, variant: "stat-card-green",   color: "#34d399" },
            { label: "Canceladas",  value: stats.cancelled, variant: "",                   color: "#f87171" },
          ].map((s, i) => (
            <div
              key={s.label}
              className={`fade-up stat-card-compact ${s.variant}`}
              style={{
                borderRadius: 16, padding: "24px 22px 20px",
                ...(s.variant === "" ? {
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.18)",
                } : {}),
                animationDelay: `${i * 55}ms`,
              }}
            >
              <p className="stat-label" style={{ color: "var(--color-text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {s.label}
              </p>
              <p className="stat-number" style={{ color: s.color, fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}


      {/* ── Appointments ────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[0,1,2].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 76, borderRadius: 14, animationDelay: `${i * 55 + 220}ms` }} />
          ))}
        </div>
      ) : view === "today" ? (
        appointments.length === 0
          ? <EmptyState message="No hay citas programadas para hoy." />
          : <AppointmentList appts={appointments} />
      ) : (
        weekGroups.length === 0
          ? <EmptyState message={view === "thisweek" ? "No hay citas programadas esta semana." : "No hay citas programadas en los próximos 14 días."} />
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {weekGroups.map(([day, appts]) => (
                <div key={day} className="fade-up">
                  {/* Day header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    {day === todayStr && (
                      <span className="pulse-dot" style={{ display: "block", width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 }} />
                    )}
                    <h2 style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em", textTransform: "capitalize" }}>
                      {formatDayHeader(day, todayStr)}
                    </h2>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      background: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                      color: "var(--color-primary)",
                      border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
                    }}>
                      {appts.length} cita{appts.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <AppointmentList appts={appts} />
                </div>
              ))}
            </div>
          )
      )}

      {showWalkIn && (
        <WalkInModal
          onClose={() => setShowWalkIn(false)}
          onSuccess={(msg) => { setShowWalkIn(false); showToast(msg); load(); }}
        />
      )}

      {diagnosisAppt && (
        <DiagnosisModal appointment={diagnosisAppt} onClose={() => setDiagnosisAppt(null)} />
      )}

      {cancelConfirm && createPortal(
        <div
          style={{
            position: "fixed", top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: "rgba(0,0,0,0.75)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "1rem", backdropFilter: "blur(4px)",
          }}
          onClick={e => { if (e.target === e.currentTarget) setCancelConfirm(null); }}
        >
          <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: 380, padding: 28 }}>
            <h3 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Cancelar cita
            </h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
              ¿Cancelar la cita de <strong style={{ color: "var(--color-text)" }}>{cancelConfirm.customerName}</strong> a las{" "}
              {cancelConfirm.appointmentDate.split("T")[1]?.substring(0, 5) ?? ""}?
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setCancelConfirm(null)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "var(--color-surface)", color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                No, volver
              </button>
              <button
                onClick={() => { handleStatus(cancelConfirm.id, "Cancelada"); setCancelConfirm(null); }}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                  background: "#dc2626", color: "#fff",
                  transition: "opacity 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, padding: "12px 20px", borderRadius: 12,
          background: "var(--color-glass-surface)", color: "var(--color-text)",
          border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
          fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {toast}
        </div>,
        document.body
      )}
    </div>
  );
};