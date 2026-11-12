import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { serviceService } from "./serviceService";
import type { Service } from "./serviceTypes";
import { Plus, Scissors, Pencil, ToggleLeft, ToggleRight, Clock, ImagePlus, Trash2 } from "lucide-react";

/* ── Portal constants ───────────────────────────────────── */
const BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
};
const PANEL: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)", borderRadius: "20px",
};
const INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: "10px", fontSize: "13px",
  background: "var(--color-surface)", color: "var(--color-text)",
  border: "1px solid var(--color-border)", outline: "none",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};
const FIELD_LABEL: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700,
  color: "var(--color-text-muted)", textTransform: "uppercase",
  letterSpacing: "0.10em", marginBottom: "6px",
};

/* ── Main component ─────────────────────────────────────── */
export const ServiceManagement: React.FC = () => {
  const [services, setServices]   = useState<Service[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [isOpen, setIsOpen]       = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string; action: "deactivate" | "activate" | "delete";
  } | null>(null);
  const [toast, setToast]         = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [durationStr, setDurationStr] = useState("30");
  const [priceStr, setPriceStr]     = useState("15000");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const loadServices = async () => {
    try {
      setLoading(true);
      setServices(await serviceService.getAll());
    } catch { setError("No se pudo cargar el catálogo."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadServices(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const openModal = (service?: Service) => {
    if (service) {
      setEditingId(service.id); setName(service.name);
      setDurationStr(String(service.durationMinutes)); setPriceStr(String(service.price));
      setCurrentImage(service.imageBase64 ?? null);
    } else {
      setEditingId(null); setName(""); setDurationStr("30"); setPriceStr("15000");
      setCurrentImage(null);
    }
    setImageFile(null); setImagePreview(null);
    setFormError(null);
    setIsOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const payload = { name, durationMinutes: Number(durationStr) || 30, price: Number(priceStr) || 0 };
    try {
      const id = editingId
        ? (await serviceService.update(editingId, payload)).id
        : (await serviceService.create(payload)).id;
      if (imageFile) await serviceService.uploadImage(id, imageFile);
      setIsOpen(false);
      showToast(editingId ? "Servicio actualizado." : "Servicio creado.");
      loadServices();
    } catch {
      setFormError("No se pudo guardar el servicio. Verifica los datos e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmTarget) return;
    try {
      if (confirmTarget.action === "deactivate") {
        const { cancelledAppointments } = await serviceService.delete(confirmTarget.id);
        if (cancelledAppointments > 0) {
          showToast(`Servicio desactivado. ${cancelledAppointments} cita${cancelledAppointments !== 1 ? "s" : ""} pendiente${cancelledAppointments !== 1 ? "s" : ""} cancelada${cancelledAppointments !== 1 ? "s" : ""}.`);
        } else {
          showToast("Servicio desactivado.");
        }
      } else if (confirmTarget.action === "activate") {
        await serviceService.activate(confirmTarget.id);
        showToast("Servicio activado.");
      } else {
        await serviceService.hardDelete(confirmTarget.id);
        showToast("Servicio eliminado.");
      }
      setConfirmTarget(null);
      loadServices();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (confirmTarget.action === "delete" && axiosErr.response?.status === 409) {
        setError(axiosErr.response.data?.message ?? "No se puede eliminar este servicio.");
      } else {
        setError("Error al actualizar el servicio.");
      }
      setConfirmTarget(null);
    }
  };

  return (
    <div className="space-y-6 fade-up">

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
            background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
          }} />
          <h1 style={{ color: "var(--color-text)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Catálogo de Servicios
          </h1>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={13} /> Nuevo Servicio
        </button>
      </div>

      {error && (
        <div style={{ borderRadius: "10px", padding: "12px 14px", fontSize: "13px", lineHeight: 1.5, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* ── Grid / skeleton / empty ──────────────────────────── */}
      {loading ? (
        <div className="service-grid">
          {[0,1,2,3,4,5].map(i => (
            <div
              key={i}
              className="skeleton-shimmer fade-up"
              style={{ height: 210, borderRadius: 16, animationDelay: `${i * 55}ms` }}
            />
          ))}
        </div>

      ) : services.length === 0 ? (
        <div
          className="fade-up"
          style={{
            borderRadius: "20px", padding: "72px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
            background: "var(--color-glass-surface)", border: "1px dashed var(--color-glass-border)",
            animationDelay: "60ms",
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: "14px", marginBottom: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
            color: "var(--color-primary)",
          }}>
            <Scissors size={20} />
          </div>
          <p style={{ color: "var(--color-text)", fontSize: "16px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Sin servicios registrados
          </p>
          <p style={{ color: "var(--color-text-muted)", fontSize: "13px", maxWidth: 280 }}>
            Crea el primer servicio para empezar a gestionar citas.
          </p>
        </div>

      ) : (
        <div className="service-grid">
          {services.map((service, idx) => {
            const isActive = service.isActive;
            return (
              <div
                key={service.id}
                className="fade-up"
                style={{
                  borderRadius: "16px", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  background: "var(--color-glass-surface)",
                  border: `1px solid ${isActive
                    ? "color-mix(in srgb, var(--color-primary) 20%, var(--color-glass-border))"
                    : "var(--color-glass-border)"}`,
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
                  opacity: isActive ? 1 : 0.62,
                  transition: "box-shadow 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1), opacity 220ms ease",
                  animationDelay: `${Math.min(idx * 45, 320)}ms`,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 10px 32px rgba(0,0,0,0.24)";
                  el.style.transform = "translateY(-2px)";
                  el.style.opacity = "1";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.12)";
                  el.style.transform = "";
                  el.style.opacity = isActive ? "1" : "0.62";
                }}
              >
                {/* Status top bar */}
                <div style={{
                  height: 3, flexShrink: 0,
                  background: isActive
                    ? "linear-gradient(90deg, var(--color-primary), var(--color-secondary))"
                    : "var(--color-border)",
                }} />

                {/* Card body */}
                <div style={{ padding: "18px 18px 14px", flex: 1, display: "flex", flexDirection: "column", gap: "14px" }}>

                  {/* Icon + name + badge */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "11px", flexShrink: 0, overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isActive
                        ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
                        : "rgba(120,120,120,0.08)",
                      color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                    }}>
                      {service.imageBase64
                        ? <img src={service.imageBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <Scissors size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
                        letterSpacing: "-0.01em", lineHeight: 1.3,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {service.name}
                      </p>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "4px",
                        marginTop: "5px", padding: "2px 8px", borderRadius: 99,
                        fontSize: "10px", fontWeight: 700,
                        background: isActive ? "rgba(16,185,129,0.12)" : "rgba(120,120,120,0.10)",
                        color: isActive ? "#34d399" : "var(--color-text-muted)",
                        border: `1px solid ${isActive ? "rgba(16,185,129,0.25)" : "var(--color-border)"}`,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, display: "block", background: isActive ? "#10b981" : "var(--color-text-muted)" }} />
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <p style={{
                    color: "var(--color-primary)", fontSize: "24px", fontWeight: 800,
                    letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums",
                  }}>
                    ${service.price.toLocaleString("es-CO")}
                  </p>

                  {/* Duration pill */}
                  <span style={{
                    display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: "5px",
                    padding: "4px 10px", borderRadius: 99,
                    fontSize: "11px", fontWeight: 600,
                    background: "color-mix(in srgb, var(--color-secondary) 10%, transparent)",
                    color: "color-mix(in srgb, var(--color-secondary) 80%, white)",
                    border: "1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)",
                  }}>
                    <Clock size={10} />
                    {service.durationMinutes} min
                  </span>
                </div>

                {/* Actions */}
                <div style={{ padding: "0 14px 14px", display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => openModal(service)}
                    className="btn-ghost"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                      padding: "7px 0", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <Pencil size={11} /> Editar
                  </button>
                  {isActive ? (
                    <button
                      onClick={() => setConfirmTarget({ id: service.id, action: "deactivate" })}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                        padding: "7px 0", borderRadius: "8px",
                        fontSize: "11px", fontWeight: 600, cursor: "pointer",
                        background: "transparent", color: "var(--color-text-muted)",
                        border: "1px solid var(--color-border)", transition: "all 150ms ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <ToggleLeft size={11} /> Desactivar
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmTarget({ id: service.id, action: "activate" })}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                        padding: "7px 0", borderRadius: "8px",
                        fontSize: "11px", fontWeight: 600, cursor: "pointer",
                        background: "rgba(16,185,129,0.10)", color: "#34d399",
                        border: "1px solid rgba(16,185,129,0.25)", transition: "background 150ms ease",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.20)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.10)")}
                    >
                      <ToggleRight size={11} /> Activar
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmTarget({ id: service.id, action: "delete" })}
                    title="Eliminar definitivamente"
                    style={{
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      width: 30, padding: "7px 0", borderRadius: "8px", cursor: "pointer",
                      background: "transparent", color: "var(--color-text-muted)",
                      border: "1px solid var(--color-border)", transition: "all 150ms ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.40)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && createPortal(
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, padding: "12px 20px", borderRadius: "12px",
          background: "var(--color-glass-surface)", color: "var(--color-text)",
          border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.40)",
          fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {toast}
        </div>,
        document.body
      )}

      {/* ── Confirm modal ────────────────────────────────────── */}
      {confirmTarget && createPortal(
        <div style={BACKDROP}>
          <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: "380px", padding: "28px" }}>
            <h3 style={{ color: "var(--color-text)", fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "8px" }}>
              {confirmTarget.action === "deactivate" ? "Desactivar servicio" : confirmTarget.action === "activate" ? "Activar servicio" : "Eliminar servicio"}
            </h3>
            <p style={{ color: "var(--color-text-muted)", fontSize: "13px", marginBottom: "24px", lineHeight: 1.5 }}>
              {confirmTarget.action === "deactivate"
                ? "Se cancelarán todas las citas pendientes asociadas a este servicio. Podrás reactivarlo más adelante."
                : confirmTarget.action === "activate"
                ? "El servicio volverá a estar disponible para nuevas citas."
                : "Esta acción es permanente y no se puede deshacer. Solo es posible si el servicio nunca ha tenido citas registradas."}
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setConfirmTarget(null)}
                className="btn-ghost"
                style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: "10px",
                  fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer",
                  color: confirmTarget.action === "activate" ? "#000" : "#fff",
                  background: confirmTarget.action === "activate"
                    ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                    : "#dc2626",
                  transition: "opacity 150ms ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {confirmTarget.action === "deactivate" ? "Sí, desactivar" : confirmTarget.action === "activate" ? "Sí, activar" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Edit / Create modal ──────────────────────────────── */}
      {isOpen && createPortal(
        <div style={BACKDROP}>
          <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: "420px", padding: "28px" }}>
            <div style={{ marginBottom: "22px" }}>
              <h3 style={{ color: "var(--color-text)", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "4px" }}>
                {editingId ? "Modificar servicio" : "Nuevo servicio"}
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                Define el nombre, duración y tarifa.
              </p>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {formError && (
                <div style={{
                  borderRadius: "10px", padding: "10px 14px", fontSize: "13px", lineHeight: 1.5,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
                }}>
                  {formError}
                </div>
              )}
              <div>
                <label style={FIELD_LABEL}>Nombre del servicio</label>
                <input
                  style={INPUT} type="text" required
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Corte degradado"
                />
              </div>
              <div>
                <label style={FIELD_LABEL}>Foto del servicio</label>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "12px", flexShrink: 0, overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "var(--color-surface)", border: "1px solid var(--color-border)",
                  }}>
                    {imagePreview || currentImage ? (
                      <img src={imagePreview ?? currentImage ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Scissors size={20} style={{ color: "var(--color-text-muted)" }} />
                    )}
                  </div>
                  <div>
                    <label
                      className="btn-ghost"
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                    >
                      <ImagePlus size={13} /> Subir foto
                      <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleImageChange} />
                    </label>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "11px", marginTop: "6px" }}>
                      PNG, JPG o WebP. Máx. 2MB.
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={FIELD_LABEL}>Duración (min)</label>
                  <input
                    style={INPUT} type="number" required
                    value={durationStr} min="5" step="5"
                    onChange={e => setDurationStr(e.target.value)}
                    onBlur={() => { const n = Number(durationStr); if (!durationStr || isNaN(n) || n < 5) setDurationStr("30"); }}
                  />
                </div>
                <div>
                  <label style={FIELD_LABEL}>Precio ($)</label>
                  <input
                    style={INPUT} type="number" required
                    value={priceStr} min="0" step="100"
                    onChange={e => setPriceStr(e.target.value)}
                    onBlur={() => { const n = Number(priceStr); if (priceStr !== "" && (isNaN(n) || n < 0)) setPriceStr("0"); }}
                  />
                </div>
              </div>
              <div style={{
                display: "flex", justifyContent: "flex-end", gap: "12px",
                paddingTop: "12px", borderTop: "1px solid var(--color-border)",
              }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-ghost"
                  style={{ padding: "9px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ padding: "9px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Guardando..." : (editingId ? "Guardar cambios" : "Crear servicio")}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};