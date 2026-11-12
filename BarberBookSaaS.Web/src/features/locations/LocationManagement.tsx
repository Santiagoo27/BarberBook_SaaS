import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MapPin, Pencil, Plus, Scissors, Sparkles, Trash2, Users } from "lucide-react";
import { locationService } from "./locationService";
import { barberService } from "../barbers/barberService";
import { serviceService } from "../services/serviceService";
import type { LocationDto, LocationDetailDto } from "./locationTypes";
import type { Barber } from "../barbers/barberTypes";
import type { Service } from "../services/serviceTypes";

const BACKDROP: React.CSSProperties = {
  position: "fixed", inset: 0,
  backgroundColor: "rgba(0,0,0,0.72)",
  zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  backdropFilter: "blur(2px)",
};
const MODAL_BOX: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)",
  borderRadius: 20,
};

const AVATAR_PALETTES = [
  { bg: "color-mix(in srgb, var(--color-primary) 20%, transparent)", color: "var(--color-primary)", border: "color-mix(in srgb, var(--color-primary) 30%, transparent)" },
  { bg: "color-mix(in srgb, var(--color-secondary) 20%, transparent)", color: "color-mix(in srgb, var(--color-secondary) 80%, white)", border: "color-mix(in srgb, var(--color-secondary) 30%, transparent)" },
  { bg: "rgba(16,185,129,0.18)", color: "#34d399", border: "rgba(16,185,129,0.3)" },
  { bg: "rgba(245,158,11,0.18)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
];

const MiniAvatar: React.FC<{ name: string; imageBase64?: string | null }> = ({ name, imageBase64 }) => {
  const p = AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
  if (imageBase64) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, overflow: "hidden", border: `1.5px solid ${p.border}` }}>
        <img src={imageBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700,
      background: p.bg, color: p.color, border: `1.5px solid ${p.border}`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

type ConfirmTarget = { type: "barber" | "service"; id: string; name: string } | null;

export const LocationManagement: React.FC = () => {
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LocationDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"barbers" | "services">("barbers");

  const [allBarbers, setAllBarbers] = useState<Barber[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [assignBarberOpen, setAssignBarberOpen] = useState(false);
  const [assignBarberId, setAssignBarberId] = useState("");
  const [assignBarberSubmitting, setAssignBarberSubmitting] = useState(false);

  const [assignServiceOpen, setAssignServiceOpen] = useState(false);
  const [assignServiceId, setAssignServiceId] = useState("");
  const [assignServiceSubmitting, setAssignServiceSubmitting] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<ConfirmTarget>(null);
  const [removing, setRemoving] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      setLocations(await locationService.getLocations());
    } catch {
      setError("No se pudieron cargar las sedes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setActiveTab("barbers");
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      const [d, barbers, services] = await Promise.all([
        locationService.getLocationDetail(id),
        barberService.getAll().catch(() => []),
        serviceService.getAll().catch(() => []),
      ]);
      setDetail(d);
      setAllBarbers(barbers);
      setAllServices(services);
    } catch {
      setError("No se pudo cargar el detalle de la sede.");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const backToList = () => {
    setSelectedId(null);
    setDetail(null);
    loadLocations();
  };

  const refreshDetail = async () => {
    if (!selectedId) return;
    const d = await locationService.getLocationDetail(selectedId);
    setDetail(d);
  };

  const openEdit = () => {
    if (!detail) return;
    setEditName(detail.name);
    setEditAddress(detail.address);
    setEditError(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await locationService.updateLocation(selectedId, { name: editName, address: editAddress });
      setDetail(prev => prev ? { ...prev, name: updated.name, address: updated.address } : prev);
      setLocations(prev => prev.map(l => l.id === selectedId ? { ...l, name: updated.name, address: updated.address } : l));
      setEditOpen(false);
    } catch {
      setEditError("No se pudo actualizar la sede.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const unassignedBarbers = allBarbers.filter(b => b.isActive && !detail?.barbers.some(db => db.id === b.id));
  const unassignedServices = allServices.filter(s => s.isActive && !detail?.services.some(ds => ds.id === s.id));

  const openAssignBarber = () => { setAssignBarberId(unassignedBarbers[0]?.id ?? ""); setAssignBarberOpen(true); };
  const openAssignService = () => { setAssignServiceId(unassignedServices[0]?.id ?? ""); setAssignServiceOpen(true); };

  const handleAssignBarber = async () => {
    if (!selectedId || !assignBarberId) return;
    setAssignBarberSubmitting(true);
    try {
      await locationService.assignBarber(selectedId, assignBarberId);
      await refreshDetail();
      setAssignBarberOpen(false);
      setAssignBarberId("");
    } catch {
      setError("No se pudo asignar el barbero.");
    } finally {
      setAssignBarberSubmitting(false);
    }
  };

  const handleAssignService = async () => {
    if (!selectedId || !assignServiceId) return;
    setAssignServiceSubmitting(true);
    try {
      await locationService.assignService(selectedId, assignServiceId);
      await refreshDetail();
      setAssignServiceOpen(false);
      setAssignServiceId("");
    } catch {
      setError("No se pudo asignar el servicio.");
    } finally {
      setAssignServiceSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!confirmRemove || !selectedId) return;
    setRemoving(true);
    try {
      if (confirmRemove.type === "barber") await locationService.removeBarber(selectedId, confirmRemove.id);
      else await locationService.removeService(selectedId, confirmRemove.id);
      await refreshDetail();
      setConfirmRemove(null);
    } catch {
      setError("No se pudo quitar la asignación.");
      setConfirmRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  /* ── Detail view ─────────────────────────────────────────── */
  if (selectedId) {
    return (
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <button
            onClick={backToList}
            style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontWeight: 600, padding: 0 }}
          >
            Sedes
          </button>
          <span style={{ color: "var(--color-text-muted)", opacity: 0.5 }}>/</span>
          <span style={{ color: "var(--color-text)", fontWeight: 700 }}>{detail?.name ?? "…"}</span>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 13 }}>
            {error}
          </div>
        )}

        {detailLoading || !detail ? (
          <div className="skeleton-shimmer" style={{ height: 320, borderRadius: 16 }} />
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                  color: "var(--color-primary)",
                }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.02em", margin: 0 }}>
                    {detail.name}
                  </h1>
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "6px 0 0" }}>
                    {detail.address || <em style={{ opacity: 0.6, fontStyle: "italic" }}>Sin dirección</em>}
                  </p>
                </div>
              </div>
              <button
                onClick={openEdit}
                className="btn-ghost location-edit-btn"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                <Pencil size={13} /> Editar
              </button>
            </div>

            {/* Tabs */}
            <div className="location-tabs" style={{
              display: "inline-flex", gap: 2, padding: 3, borderRadius: 10,
              background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            }}>
              {[
                { key: "barbers" as const, label: "Barberos", icon: <Scissors size={13} />, count: detail.barbers.length },
                { key: "services" as const, label: "Servicios", icon: <Sparkles size={13} />, count: detail.services.length },
              ].map(t => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8,
                      fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
                      transition: "all 150ms ease",
                      background: isActive
                        ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                        : "transparent",
                      color: isActive ? "#000" : "var(--color-text-muted)",
                    }}
                  >
                    {t.icon} {t.label} ({t.count})
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            {activeTab === "barbers" ? (
              <div style={{
                borderRadius: 16, overflow: "hidden",
                background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={openAssignBarber}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Plus size={13} /> Asignar barbero
                  </button>
                </div>
                {detail.barbers.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ color: "var(--color-text-muted)", fontSize: 13, fontWeight: 500 }}>
                      Esta sede no tiene barberos asignados aún
                    </p>
                  </div>
                ) : (
                  detail.barbers.map((b, idx) => (
                    <div key={b.id} className="location-row" style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "18px 24px",
                      borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
                    }}>
                      <MiniAvatar name={b.name} imageBase64={b.imageBase64} />
                      <div className="location-row-info" style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{b.name}</p>
                        {b.specialty && <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>{b.specialty}</p>}
                      </div>
                      <button
                        onClick={() => setConfirmRemove({ type: "barber", id: b.id, name: b.name })}
                        className="location-row-action"
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                          border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)",
                          transition: "all 150ms ease",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                      >
                        <Trash2 size={11} /> Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{
                borderRadius: 16, overflow: "hidden",
                background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={openAssignService}
                    className="btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Plus size={13} /> Asignar servicio
                  </button>
                </div>
                {detail.services.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <p style={{ color: "var(--color-text-muted)", fontSize: 13, fontWeight: 500 }}>
                      Esta sede no tiene servicios asignados aún
                    </p>
                  </div>
                ) : (
                  detail.services.map((s, idx) => (
                    <div key={s.id} className="location-row" style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "18px 24px",
                      borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "color-mix(in srgb, var(--color-secondary) 16%, transparent)",
                        color: "color-mix(in srgb, var(--color-secondary) 80%, white)",
                      }}>
                        <Sparkles size={16} />
                      </div>
                      <div className="location-row-info" style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{s.name}</p>
                        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
                          ${s.price.toLocaleString("es-CO")} &middot; {s.durationMinutes} min
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmRemove({ type: "service", id: s.id, name: s.name })}
                        className="location-row-action"
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0,
                          border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)",
                          transition: "all 150ms ease",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                      >
                        <Trash2 size={11} /> Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ── Modal: editar sede ────────────────────────────── */}
        {editOpen && createPortal(
          <div style={BACKDROP}>
            <div style={{ ...MODAL_BOX, maxWidth: 420, width: "100%", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 20px" }}>Editar sede</h3>
              <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {editError && (
                  <div style={{ borderRadius: 10, padding: "10px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171" }}>
                    {editError}
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nombre</label>
                  <input
                    type="text" required maxLength={100} value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="input-theme"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Dirección</label>
                  <input
                    type="text" required maxLength={256} value={editAddress}
                    onChange={e => setEditAddress(e.target.value)}
                    className="input-theme"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13 }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 8, borderTop: "1px solid var(--color-glass-border)", marginTop: 4 }}>
                  <button type="button" onClick={() => setEditOpen(false)} className="btn-ghost" style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={editSubmitting} className="btn-primary" style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: editSubmitting ? "not-allowed" : "pointer" }}>
                    {editSubmitting ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* ── Modal: asignar barbero ─────────────────────────── */}
        {assignBarberOpen && createPortal(
          <div style={BACKDROP}>
            <div style={{ ...MODAL_BOX, maxWidth: 420, width: "100%", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 16px" }}>Asignar barbero</h3>
              {unassignedBarbers.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
                  Todos los barberos activos ya están asignados a esta sede.
                </p>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Barbero</label>
                  <select
                    value={assignBarberId}
                    onChange={e => setAssignBarberId(e.target.value)}
                    className="input-theme"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13 }}
                  >
                    {unassignedBarbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}{b.specialty ? ` — ${b.specialty}` : ""}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setAssignBarberOpen(false)} className="btn-ghost" style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                {unassignedBarbers.length > 0 && (
                  <button
                    onClick={handleAssignBarber}
                    disabled={assignBarberSubmitting}
                    className="btn-primary"
                    style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: assignBarberSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {assignBarberSubmitting ? "Asignando..." : "Asignar"}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Modal: asignar servicio ─────────────────────────── */}
        {assignServiceOpen && createPortal(
          <div style={BACKDROP}>
            <div style={{ ...MODAL_BOX, maxWidth: 420, width: "100%", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 16px" }}>Asignar servicio</h3>
              {unassignedServices.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
                  Todos los servicios activos ya están asignados a esta sede.
                </p>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Servicio</label>
                  <select
                    value={assignServiceId}
                    onChange={e => setAssignServiceId(e.target.value)}
                    className="input-theme"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13 }}
                  >
                    {unassignedServices.map(s => (
                      <option key={s.id} value={s.id}>{s.name} — ${s.price.toLocaleString("es-CO")}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setAssignServiceOpen(false)} className="btn-ghost" style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                {unassignedServices.length > 0 && (
                  <button
                    onClick={handleAssignService}
                    disabled={assignServiceSubmitting}
                    className="btn-primary"
                    style={{ padding: "8px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: assignServiceSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {assignServiceSubmitting ? "Asignando..." : "Asignar"}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Modal: confirmar quitar ─────────────────────────── */}
        {confirmRemove && createPortal(
          <div style={BACKDROP}>
            <div style={{ ...MODAL_BOX, maxWidth: 380, width: "100%", padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 8px" }}>
                ¿Quitar {confirmRemove.type === "barber" ? "barbero" : "servicio"}?
              </h3>
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 20px" }}>
                <strong style={{ color: "var(--color-text)" }}>{confirmRemove.name}</strong> dejará de estar asignado a esta sede.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmRemove(null)} className="btn-ghost" style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRemove}
                  disabled={removing}
                  style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#dc2626", color: "#fff", border: "none", cursor: removing ? "not-allowed" : "pointer", transition: "background 150ms ease" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#b91c1c")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}
                >
                  {removing ? "Quitando..." : "Sí, quitar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  /* ── List view ───────────────────────────────────────────── */
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
        <div style={{
          width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0,
          background: "linear-gradient(180deg, var(--color-primary), var(--color-secondary))",
        }} />
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 30, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.03em", lineHeight: 1, margin: 0 }}>
            <MapPin size={26} /> Sedes
          </h1>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", margin: "6px 0 0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {locations.length} sede{locations.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div style={{
        borderRadius: 12, padding: "14px 18px", fontSize: 13, lineHeight: 1.6,
        background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc",
      }}>
        Las sedes son creadas por el administrador del sistema. Aquí puedes configurar los barberos y servicios de cada una.
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 10, padding: "12px 16px", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="location-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 152, borderRadius: 16 }} />
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          padding: "72px 24px",
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          borderRadius: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MapPin size={22} style={{ color: "var(--color-text-muted)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Sin sedes configuradas</p>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>El administrador del sistema aún no ha creado sedes para tu barbería.</p>
          </div>
        </div>
      ) : (
        <div className="location-grid">
          {locations.map((loc, idx) => (
            <div
              key={loc.id}
              className="fade-up location-card"
              style={{
                animationDelay: `${idx * 55}ms`,
                background: "var(--color-glass-surface)",
                border: "1px solid var(--color-glass-border)",
                borderRadius: 16,
                padding: "24px",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                transition: "transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.22)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
                  color: "var(--color-primary)",
                }}>
                  <MapPin size={19} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    fontSize: 15, fontWeight: 700, color: "var(--color-text)", margin: 0, lineHeight: 1.35,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {loc.name}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {loc.address || <em style={{ opacity: 0.6, fontStyle: "italic" }}>Sin dirección</em>}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: "var(--color-glass-border)", opacity: 0.8 }} />

              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, columnGap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  <Users size={13} /> {loc.barberCount} barbero{loc.barberCount !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  <Sparkles size={13} /> {loc.serviceCount} servicio{loc.serviceCount !== 1 ? "s" : ""}
                </div>
              </div>

              <button
                onClick={() => openDetail(loc.id)}
                className="btn-primary"
                style={{ padding: "11px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 2 }}
              >
                Administrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
