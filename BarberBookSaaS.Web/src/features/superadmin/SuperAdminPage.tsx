import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Users, Calendar, Shield, ShieldOff, Trash2, Plus, Sparkles, Download, X, Scissors, Copy, Check, MapPin, Clock } from "lucide-react";
import { DiagnosisInfographic } from "../../components/DiagnosisInfographic";
import type { DiagnosisResult } from "../barbers/aiDiagnosisService";
import type { LocationDto } from "../locations/locationTypes";
import {
  superAdminService,
  type TenantSummary,
  type CreateTenantForm,
  type DiagnosisRecord,
  type SavedDiagnosis,
} from "./superAdminService";

const EMPTY_FORM: CreateTenantForm = {
  barberiaName: "",
  subdomain: "",
  phone: "",
  address: "",
  adminEmail: "",
};

export const SuperAdminPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateTenantForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TenantSummary | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TenantSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCredentials, setNewCredentials] = useState<{ subdomain: string; email: string; password: string } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [diagTenant, setDiagTenant] = useState<TenantSummary | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [showTestIA, setShowTestIA] = useState(false);
  const [, setTestFile] = useState<File | null>(null);
  const [testPreview, setTestPreview] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testLoadingMsg, setTestLoadingMsg] = useState("");
  const [testResult, setTestResult] = useState<DiagnosisResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [savedDiags, setSavedDiags] = useState<SavedDiagnosis[]>([]);
  const [viewDiagResult, setViewDiagResult] = useState<{ label: string; data: Record<string, unknown> } | null>(null);
  const [savingDiag, setSavingDiag] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [imageLoaded, setImageLoaded] = useState(false);
  const diagContainerRef = useRef<HTMLDivElement>(null);

  // ── Sedes (SuperAdmin) ─────────────────────────────────────────────────
  const [locationsTenant, setLocationsTenant] = useState<TenantSummary | null>(null);
  const [tenantLocations, setTenantLocations] = useState<LocationDto[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationAddress, setNewLocationAddress] = useState("");
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [deleteLocationTarget, setDeleteLocationTarget] = useState<LocationDto | null>(null);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setTenants(await superAdminService.listTenants()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); superAdminService.getMyDiagnoses().then(setSavedDiags).catch(() => {}); }, []);

  const openModal = () => { setForm(EMPTY_FORM); setError(null); setAcceptedTerms(false); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-+/, "")
      .replace(/-{2,}/g, "-");
    setForm((f) => ({ ...f, subdomain: val }));
  };

  const SUBDOMAIN_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const finalSubdomain = form.subdomain.replace(/-+$/, "");
    if (!SUBDOMAIN_RE.test(finalSubdomain)) {
      setError("El subdominio no puede empezar ni terminar con guión. Usa solo letras, números y guiones (mín. 3 caracteres).");
      setSaving(false);
      return;
    }
    try {
      const { temporaryPassword } = await superAdminService.createTenant({ ...form, subdomain: finalSubdomain });
      setShowModal(false);
      setNewCredentials({ subdomain: finalSubdomain, email: form.adminEmail, password: temporaryPassword });
      await load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const serverMsg = e.response?.data?.message
        ?? Object.values(e.response?.data?.errors ?? {}).flat().join(" ")
        ?? "Error al crear la barbería.";
      setError(serverMsg);
    } finally { setSaving(false); }
  };

  const handlePlanChange = async (tenant: TenantSummary, newPlan: string) => {
    if (newPlan === tenant.plan) return;
    setUpdatingPlanId(tenant.id);
    try {
      await superAdminService.updatePlan(tenant.id, newPlan);
      setTenants(ts => ts.map(t => t.id === tenant.id ? { ...t, plan: newPlan } : t));
    } finally { setUpdatingPlanId(null); }
  };

  const requestStatusToggle = (tenant: TenantSummary) => {
    if (tenant.isWebActive) setConfirmTarget(tenant);
    else void doStatusToggle(tenant, true);
  };

  const doStatusToggle = async (tenant: TenantSummary, isWebActive: boolean) => {
    setConfirmTarget(null);
    setTogglingId(tenant.id);
    try {
      await superAdminService.updateStatus(tenant.id, isWebActive);
      setTenants(ts => ts.map(t => t.id === tenant.id ? { ...t, isWebActive } : t));
    } finally { setTogglingId(null); }
  };

  const doDeleteTenant = async (tenant: TenantSummary) => {
    setDeleteTarget(null);
    setDeletingId(tenant.id);
    try {
      await superAdminService.deleteTenant(tenant.id);
      setTenants(ts => ts.filter(t => t.id !== tenant.id));
    } finally { setDeletingId(null); }
  };

  const handleTestFile = (f: File) => {
    setTestFile(f);
    setTestResult(null);
    setTestError(null);
    const img = new Image();
    img.onload = () => {
      const maxSize = 1024;
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      setTestPreview(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = URL.createObjectURL(f);
  };

  const handleTestDiagnosis = async () => {
    if (!testPreview) return;
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    const msgs = ["Analizando imagen...", "Generando cortes...", "Casi listo..."];
    setTestLoadingMsg(msgs[0]);
    const t1 = setTimeout(() => setTestLoadingMsg(msgs[1]), 8000);
    const t2 = setTimeout(() => setTestLoadingMsg(msgs[2]), 25000);
    try {
      const base64 = testPreview.split(",")[1];
      const result = await superAdminService.testDiagnosis(base64);
      setTestResult(result as unknown as DiagnosisResult);
    } catch {
      setTestError("Error al analizar. Intenta de nuevo.");
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setTestLoading(false);
    }
  };

  const resetTest = () => {
    setTestFile(null);
    setTestPreview(null);
    setTestResult(null);
    setTestError(null);
  };

  const handleSaveDiagnosis = async () => {
    if (!testResult) return;
    setSavingDiag(true);
    try {
      const label = `Diagnóstico ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      await superAdminService.saveMyDiagnosis(label, JSON.stringify(testResult));
      setSavedMsg("✓ Guardado");
      setTimeout(() => setSavedMsg(""), 3000);
      superAdminService.getMyDiagnoses().then(setSavedDiags).catch(() => {});
    } catch { setSavedMsg("Error al guardar"); }
    finally { setSavingDiag(false); }
  };

  const handleViewSaved = async (d: SavedDiagnosis) => {
    try {
      const data = await superAdminService.getMyDiagnosis(d.id);
      setViewDiagResult({ label: d.label, data: data as Record<string, unknown> });
    } catch { /* */ }
  };

  const handleDeleteSaved = async (id: string) => {
    await superAdminService.deleteMyDiagnosis(id);
    setSavedDiags(prev => prev.filter(d => d.id !== id));
    if (viewDiagResult) setViewDiagResult(null);
  };

  const openDiagnoses = async (t: TenantSummary) => {
    setDiagTenant(t);
    setDiagLoading(true);
    try { setDiagnoses(await superAdminService.getDiagnoses(t.id)); }
    finally { setDiagLoading(false); }
  };

  const handleDeleteDiagnosis = async (id: string) => {
    await superAdminService.deleteDiagnosis(id);
    setDiagnoses(prev => prev.filter(d => d.id !== id));
  };

  const handleDownloadDiagnosis = (d: DiagnosisRecord) => {
    try {
      const parsed = JSON.parse(d.aiDiagnosisJson);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `diagnostico-${d.customerName.replace(/\s+/g, "-").toLowerCase()}-${d.appointmentDate.split("T")[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch { /* non-critical */ }
  };

  const reloadTenantLocations = async (tenantId: string) => {
    try {
      setTenantLocations(await superAdminService.getLocationsForTenant(tenantId));
    } catch {
      setLocationsError("No se pudieron cargar las sedes.");
    }
  };

  const openLocationsModal = async (t: TenantSummary) => {
    setLocationsTenant(t);
    setTenantLocations([]);
    setNewLocationName("");
    setNewLocationAddress("");
    setLocationsError(null);
    setLocationsLoading(true);
    try {
      setTenantLocations(await superAdminService.getLocationsForTenant(t.id));
    } catch {
      setLocationsError("No se pudieron cargar las sedes.");
    } finally {
      setLocationsLoading(false);
    }
  };

  const closeLocationsModal = () => {
    setLocationsTenant(null);
    setDeleteLocationTarget(null);
  };

  const handleCreateLocation = async () => {
    if (!locationsTenant) return;
    const name = newLocationName.trim();
    const address = newLocationAddress.trim();
    if (!name || !address) return;
    setCreatingLocation(true);
    setLocationsError(null);
    try {
      await superAdminService.createLocationForTenant(locationsTenant.id, { name, address });
      setNewLocationName("");
      setNewLocationAddress("");
      await reloadTenantLocations(locationsTenant.id);
    } catch {
      setLocationsError("No se pudo crear la sede.");
    } finally {
      setCreatingLocation(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!locationsTenant || !deleteLocationTarget) return;
    setDeletingLocationId(deleteLocationTarget.id);
    try {
      await superAdminService.deleteLocationForTenant(locationsTenant.id, deleteLocationTarget.id);
      setDeleteLocationTarget(null);
      await reloadTenantLocations(locationsTenant.id);
    } catch {
      setLocationsError("No se pudo eliminar la sede.");
      setDeleteLocationTarget(null);
    } finally {
      setDeletingLocationId(null);
    }
  };

  const activeCount = tenants.filter(t => t.isWebActive).length;
  const suspendedCount = tenants.length - activeCount;
  const totalDiagnoses = tenants.reduce((sum, t) => sum + t.totalDiagnoses, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", letterSpacing: "-0.02em", margin: 0 }}>Barberías</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
            {tenants.length} tenant{tenants.length !== 1 ? "s" : ""} registrado{tenants.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowTestIA(true); resetTest(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10,
              border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)",
              color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(167,139,250,0.08)")}
          >
            <Sparkles size={15} /> Probar IA
          </button>
          <button
            onClick={openModal}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none",
              background: "var(--color-primary)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer",
              transition: "opacity 150ms",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <Plus size={15} /> Nueva barbería
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="sa-stats-grid">
        {[
          { label: "Total", value: tenants.length, icon: <Building2 size={18} />, color: "var(--color-primary)" },
          { label: "Activas", value: activeCount, icon: <Shield size={18} />, color: "#34d399" },
          { label: "Suspendidas", value: suspendedCount, icon: <ShieldOff size={18} />, color: "#f87171" },
          { label: "Diagnósticos IA", value: totalDiagnoses, icon: <Sparkles size={18} />, color: "#a78bfa" },
        ].map(s => (
          <div key={s.label} style={{
            padding: "18px 20px", borderRadius: 14,
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color,
            }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>{s.label}</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1, marginTop: 2 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Saved diagnoses */}
      {savedDiags.length > 0 && (
        <div style={{ borderRadius: 16, background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-glass-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={15} style={{ color: "#a78bfa" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>Mis diagnósticos IA</span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>({savedDiags.length})</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {savedDiags.map((d, i) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i > 0 ? "1px solid var(--color-glass-border)" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Sparkles size={15} style={{ color: "#a78bfa" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>{new Date(d.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <button onClick={() => handleViewSaved(d)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.08)", color: "#a78bfa", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Ver
                </button>
                <button onClick={() => handleDeleteSaved(d.id)} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View saved diagnosis modal — same structure as test result modal */}
      {viewDiagResult && createPortal(
        <div
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.80)", zIndex: 9999, overflowY: "auto", backdropFilter: "blur(4px)",
            "--color-primary": "#a78bfa", "--color-text": "#f5f5f5", "--color-text-muted": "#8a8a8a",
            "--color-surface": "#1a1a1a", "--color-border": "#2a2a2a",
            "--color-glass-surface": "rgba(255,255,255,0.04)", "--color-glass-border": "rgba(255,255,255,0.08)",
            "--color-glass-surface-hover": "rgba(255,255,255,0.08)",
          } as React.CSSProperties}
          onClick={e => { if (e.target === e.currentTarget) setViewDiagResult(null); }}
        >
          <div style={{ display: "flex", minHeight: "100%", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem" }}>
            <div className="fade-up" style={{
              background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
              borderRadius: 20, backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.70)",
              position: "relative", width: "100%", maxWidth: 860,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)" }}>
                <div>
                  <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Diagnóstico IA</h2>
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 3 }}>{viewDiagResult.label}</p>
                </div>
                <button
                  onClick={() => setViewDiagResult(null)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-glass-surface-hover)", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 150ms ease" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; }}
                >
                  <X size={15} />
                </button>
              </div>
              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {(() => {
                  const d = viewDiagResult.data as unknown as DiagnosisResult;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {d.imageBase64 ? (
                        <div style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
                          <img src={`data:image/png;base64,${d.imageBase64}`} alt="Catálogo de estilos IA" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                          {d.styles?.slice(0, 4).map((s, i) => (
                            <div key={i} style={{
                              position: "absolute", bottom: i < 2 ? "50%" : 0, left: i % 2 === 0 ? 0 : "50%", width: "50%",
                              display: "flex", justifyContent: "center", alignItems: "flex-end", paddingBottom: 12,
                            }}>
                              <span className="diagnosis-cut-label" style={{
                                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "white", fontSize: 13, fontWeight: 700,
                                padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)",
                                textAlign: "center", letterSpacing: "0.03em", maxWidth: "90%", textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                              }}>{s.name}</span>
                            </div>
                          ))}
                          <div className="diagnosis-logo" style={{
                            position: "absolute", top: 12, right: 12, borderRadius: "50%",
                            border: "3px solid white", background: "#a78bfa",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: 4,
                          }}>
                            <Scissors size={36} color="white" />
                          </div>
                        </div>
                      ) : (
                        <div style={{ borderRadius: 12, padding: 24, textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>Imagen disponible solo con API de Gemini configurada</p>
                        </div>
                      )}
                      <DiagnosisInfographic data={d} clientPhotoUrl={null} />
                      {d.imageBase64 && (
                        <button
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = `data:image/png;base64,${d.imageBase64}`;
                            link.download = `diagnostico-ia-${new Date().toISOString().split("T")[0]}.png`;
                            link.click();
                          }}
                          className="btn-primary"
                          style={{ padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                        >
                          <Download size={14} /> Descargar JPG
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Tenant list */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <span style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--color-glass-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "block" }} />
        </div>
      ) : tenants.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", borderRadius: 16,
          background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
        }}>
          <Building2 size={36} style={{ color: "var(--color-text-muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No hay barberías registradas aún.</p>
        </div>
      ) : (
        <div className="sa-tenant-grid">
          {tenants.map(t => (
            <div key={t.id} style={{
              borderRadius: 16, overflow: "hidden",
              background: "var(--color-glass-surface)",
              border: t.isWebActive ? "1px solid var(--color-glass-border)" : "1px solid rgba(239,68,68,0.3)",
              transition: "border-color 200ms, box-shadow 200ms",
            }}>
              {/* Card header */}
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-glass-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: t.isWebActive ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "rgba(239,68,68,0.1)",
                    color: t.isWebActive ? "var(--color-primary)" : "#f87171", flexShrink: 0,
                  }}>
                    <Building2 size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.name || <em style={{ opacity: 0.4 }}>sin nombre</em>}
                    </p>
                    <p style={{ fontSize: 11, fontFamily: "monospace", color: "var(--color-primary)", margin: 0 }}>/book/{t.id}</p>
                  </div>
                </div>
                {/* Plan selector */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {updatingPlanId === t.id ? (
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "4px 8px" }}>...</span>
                  ) : (
                    <select
                      value={t.plan}
                      onChange={e => handlePlanChange(t, e.target.value)}
                      style={{
                        appearance: "none", WebkitAppearance: "none",
                        padding: "4px 24px 4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        border: "1px solid",
                        cursor: "pointer", transition: "all 150ms",
                        background: t.plan === "PremiumUnlimited"
                          ? "color-mix(in srgb, #f59e0b 15%, transparent)"
                          : t.plan === "Premium"
                            ? "color-mix(in srgb, #a78bfa 15%, transparent)"
                            : "var(--color-surface)",
                        borderColor: t.plan === "PremiumUnlimited"
                          ? "rgba(245,158,11,0.35)"
                          : t.plan === "Premium"
                            ? "rgba(167,139,250,0.35)"
                            : "var(--color-border)",
                        color: t.plan === "PremiumUnlimited"
                          ? "#f59e0b"
                          : t.plan === "Premium"
                            ? "#a78bfa"
                            : "var(--color-text-muted)",
                        outline: "none",
                      }}
                    >
                      <option value="Standard">Estándar</option>
                      <option value="Premium">Premium</option>
                      <option value="PremiumUnlimited">Premium ∞</option>
                    </select>
                  )}
                  <span style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    pointerEvents: "none", fontSize: 8,
                    color: t.plan === "PremiumUnlimited" ? "#f59e0b" : t.plan === "Premium" ? "#a78bfa" : "var(--color-text-muted)",
                  }}>▼</span>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: "14px 18px" }}>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.adminEmail}
                </p>

                {/* Billing info */}
                {t.createdAt && (() => {
                  const nextBilling = new Date(t.currentPeriodStart);
                  nextBilling.setDate(nextBilling.getDate() + 30);
                  const daysLeft = Math.ceil((nextBilling.getTime() - Date.now()) / 86_400_000);
                  const urgent = daysLeft <= 5;
                  const fmtDate = (d: Date) => d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, marginBottom: 10,
                      background: urgent ? "rgba(245,158,11,0.08)" : "var(--color-surface)",
                      border: `1px solid ${urgent ? "rgba(245,158,11,0.25)" : "var(--color-glass-border)"}`,
                    }}>
                      <Clock size={12} style={{ color: urgent ? "#f59e0b" : "var(--color-text-muted)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          Desde {fmtDate(new Date(t.createdAt))}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 4px" }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: urgent ? "#f59e0b" : "var(--color-text-muted)" }}>
                          Cobro {fmtDate(nextBilling)}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                        background: urgent ? "rgba(245,158,11,0.15)" : "rgba(96,165,250,0.1)",
                        color: urgent ? "#f59e0b" : "#60a5fa",
                      }}>
                        {daysLeft}d
                      </span>
                    </div>
                  );
                })()}

                {/* Stats row */}
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "var(--color-surface)", flex: 1, minWidth: 0 }}>
                    <Users size={13} style={{ color: "#60a5fa", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Barberos</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#60a5fa", marginLeft: "auto" }}>{t.totalBarbers}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "var(--color-surface)", flex: 1, minWidth: 0 }}>
                    <Calendar size={13} style={{ color: "#34d399", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Citas</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#34d399", marginLeft: "auto" }}>{t.totalAppointments}</span>
                  </div>
                  {t.plan !== "Standard" && (() => {
                    const unlimited = t.plan === "PremiumUnlimited";
                    const remaining = t.diagnosisRemaining;
                    const iaColor = unlimited ? "#f59e0b" : remaining <= 10 ? "#f87171" : remaining <= 30 ? "#f59e0b" : "#a78bfa";
                    return (
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "var(--color-surface)", flex: 1, minWidth: 0 }}
                        title={unlimited ? "Plan ilimitado — sin restricción de diagnósticos IA" : `Quedan ${remaining} de 100 diagnósticos IA este período`}
                      >
                        <Sparkles size={13} style={{ color: iaColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{unlimited ? "IA" : "IA quedan"}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: iaColor, marginLeft: "auto" }}>{unlimited ? "∞" : remaining}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  {t.totalDiagnoses > 0 && (
                    <button
                      onClick={() => openDiagnoses(t)}
                      style={{
                        width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: 8, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.06)",
                        color: "#a78bfa", cursor: "pointer", transition: "all 150ms", flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(167,139,250,0.15)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(167,139,250,0.06)"; }}
                      title="Ver diagnósticos IA"
                    >
                      <Sparkles size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => openLocationsModal(t)}
                    style={{
                      height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: "1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)",
                      background: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                      color: "var(--color-primary)", cursor: "pointer", transition: "all 150ms", flexShrink: 0, whiteSpace: "nowrap",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 18%, transparent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-primary) 8%, transparent)"; }}
                    title="Gestionar sedes"
                  >
                    <MapPin size={14} /> Sedes
                  </button>
                  <button
                    onClick={() => requestStatusToggle(t)}
                    disabled={togglingId === t.id}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: togglingId === t.id ? "not-allowed" : "pointer",
                      border: "1px solid", transition: "all 150ms",
                      background: t.isWebActive ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                      borderColor: t.isWebActive ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                      color: t.isWebActive ? "#34d399" : "#f87171",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.isWebActive ? "#34d399" : "#f87171" }} />
                    {togglingId === t.id ? "..." : t.isWebActive ? "Activo" : "Suspendido"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(t)}
                    disabled={deletingId === t.id}
                    style={{
                      width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
                      color: "#f87171", cursor: deletingId === t.id ? "not-allowed" : "pointer", transition: "all 150ms", flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal — delete */}
      {deleteTarget && (
        <ConfirmModal
          title={`¿Eliminar ${deleteTarget.name || deleteTarget.id}?`}
          subtitle={<>Subdominio: <span style={{ fontFamily: "monospace", color: "var(--color-primary)" }}>{deleteTarget.id}</span></>}
          description="Esta acción es permanente. Se eliminarán todos los datos del tenant."
          confirmLabel="Eliminar definitivamente"
          confirmColor="#ef4444"
          onConfirm={() => doDeleteTenant(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Confirmation modal — suspend */}
      {confirmTarget && (
        <ConfirmModal
          title={`¿Suspender ${confirmTarget.name || confirmTarget.id}?`}
          description="Todos los usuarios de esta barbería no podrán acceder al sistema ni a la página de reservas."
          confirmLabel="Suspender"
          confirmColor="#ef4444"
          onConfirm={() => doStatusToggle(confirmTarget, false)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {/* Modal crear barbería */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem", overflowY: "auto" }}>
          <div style={{
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            borderRadius: 20, padding: "28px 28px", width: "100%", maxWidth: 460,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--color-text)", margin: "0 0 20px", letterSpacing: "-0.02em" }}>Nueva Barbería</h2>
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{ borderRadius: 10, padding: "12px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171", marginBottom: 12 }}>
                  {error}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FormField label="Nombre de la Barbería" name="barberiaName" value={form.barberiaName} onChange={handleChange} required placeholder="Mi Barbería" />
                <div>
                  <label style={labelStyle}>Subdominio <span style={{ color: "var(--color-text-muted)", fontWeight: 400, textTransform: "none" }}>(letras, números y guiones)</span></label>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
                    <span style={{ padding: "9px 12px", color: "var(--color-text-muted)", fontSize: 13, borderRight: "1px solid var(--color-border)", flexShrink: 0, userSelect: "none" }}>/book/</span>
                    <input name="subdomain" value={form.subdomain} onChange={handleSubdomainChange} required minLength={3} placeholder="mibarberia"
                      style={{ flex: 1, padding: "9px 12px", background: "transparent", color: "var(--color-primary)", fontSize: 13, fontFamily: "monospace", fontWeight: 700, outline: "none", border: "none" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FormField label="Teléfono" name="phone" value={form.phone} onChange={handleChange} placeholder="3001234567" />
                  <FormField label="Dirección" name="address" value={form.address} onChange={handleChange} placeholder="Calle 10 #20-30" />
                </div>
                <FormField label="Email del Admin" name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} required placeholder="admin@barberia.com" />
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: 0 }}>
                  Se generará una contraseña temporal automáticamente al crear la barbería.
                </p>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", userSelect: "none", marginTop: 16 }}>
                <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "var(--color-primary)", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                  Acepto los <a href="/terms" target="_blank" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Términos y Condiciones</a>
                  {" "}y la <a href="/privacy" target="_blank" style={{ color: "var(--color-primary)", textDecoration: "underline" }}>Política de Privacidad</a>.
                </span>
              </label>

              <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-glass-border)" }}>
                <button type="button" onClick={closeModal}
                  style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", transition: "all 150ms" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "var(--color-text)"; e.currentTarget.style.borderColor = "var(--color-text-muted)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
                >Cancelar</button>
                <button type="submit" disabled={saving || !acceptedTerms}
                  style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "none", background: "var(--color-primary)", color: "#000", cursor: (saving || !acceptedTerms) ? "not-allowed" : "pointer", opacity: (saving || !acceptedTerms) ? 0.5 : 1, transition: "opacity 150ms" }}
                >{saving ? "Creando..." : "Crear Barbería"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal credenciales de la barbería creada */}
      {newCredentials && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem" }}>
          <div style={{
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            borderRadius: 20, padding: 24, width: "100%", maxWidth: 440,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "color-mix(in srgb, var(--color-primary) 15%, transparent)",
              }}>
                <Building2 size={18} style={{ color: "var(--color-primary)" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", margin: "0 0 4px" }}>Barbería creada</h3>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                  Comparte estas credenciales con el administrador de la barbería.
                </p>
              </div>
            </div>

            <div style={{
              borderRadius: 12, padding: 16, marginBottom: 12,
              background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))",
              border: "1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>Credenciales de acceso</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <CredentialRow label="Subdominio" value={newCredentials.subdomain} />
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)", paddingTop: 12 }}>
                  <CredentialRow label="Correo" value={newCredentials.email} />
                </div>
                <div style={{ borderTop: "1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)", paddingTop: 12 }}>
                  <CredentialRow label="Contraseña temporal" value={newCredentials.password} mono />
                </div>
              </div>
            </div>

            <p style={{ fontSize: 11, padding: "8px 12px", borderRadius: 8, margin: "0 0 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
              Al ingresar por primera vez, se le pedirá cambiar esta contraseña.
            </p>

            <button
              onClick={() => setNewCredentials(null)}
              style={{ width: "100%", padding: "10px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "none", background: "var(--color-primary)", color: "#000", cursor: "pointer" }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Test IA modal */}
      {showTestIA && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem", overflowY: "auto" }}
          onClick={e => { if (e.target === e.currentTarget && !testLoading) setShowTestIA(false); }}>
          <div style={{ background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)", borderRadius: 20, width: "100%", maxWidth: testResult ? 700 : 460, maxHeight: "90vh", display: "flex", flexDirection: "column", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", transition: "max-width 0.3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--color-glass-border)" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>Probar Diagnóstico IA</h2>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0" }}>Sube una foto y prueba el análisis</p>
              </div>
              <button onClick={() => { if (!testLoading) setShowTestIA(false); }} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 22px" }}>
              {!testResult && !testLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {testPreview ? (
                    <div style={{ position: "relative" }}>
                      <img src={testPreview} alt="Preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 12, background: "#111" }} />
                      <button onClick={resetTest} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(0,0,0,0.7)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "40px 20px", borderRadius: 14, border: "2px dashed var(--color-border)", cursor: "pointer", transition: "border-color 150ms" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "#a78bfa")} onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--color-border)")}>
                      <Sparkles size={28} style={{ color: "#a78bfa" }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>Seleccionar foto</span>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>JPG o PNG — cara visible de frente</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleTestFile(f); }} />
                    </label>
                  )}
                  {testError && <p style={{ fontSize: 13, color: "#f87171", fontWeight: 600, margin: 0 }}>{testError}</p>}
                  {testPreview && (
                    <button onClick={handleTestDiagnosis} style={{ padding: "12px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Sparkles size={16} /> Analizar con IA
                    </button>
                  )}
                </div>
              )}
              {testLoading && (
                <div style={{ textAlign: "center", padding: "50px 0" }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", border: "2.5px solid var(--color-border)", borderTopColor: "#a78bfa", animation: "spin 0.7s linear infinite", display: "inline-block", marginBottom: 16 }} />
                  <p style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 600, margin: 0 }}>{testLoadingMsg}</p>
                </div>
              )}
              {testResult && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", margin: "0 0 12px" }}>Diagnóstico generado correctamente</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <button onClick={() => setShowTestIA(false)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Ver resultado completo
                    </button>
                    <button onClick={resetTest} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Otra foto
                    </button>
                  </div>
                  {savedMsg && <p style={{ fontSize: 12, fontWeight: 600, color: savedMsg.startsWith("✓") ? "#10b981" : "#f87171", margin: "8px 0 0" }}>{savedMsg}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test result fullscreen modal — exact copy of barber DiagnosisModal */}
      {testResult && !showTestIA && createPortal(
        <div
          style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.80)", zIndex: 9999, overflowY: "auto", backdropFilter: "blur(4px)",
            // CSS variables needed by DiagnosisInfographic
            "--color-primary": "#a78bfa", "--color-text": "#f5f5f5", "--color-text-muted": "#8a8a8a",
            "--color-surface": "#1a1a1a", "--color-border": "#2a2a2a",
            "--color-glass-surface": "rgba(255,255,255,0.04)", "--color-glass-border": "rgba(255,255,255,0.08)",
            "--color-glass-surface-hover": "rgba(255,255,255,0.08)",
          } as React.CSSProperties}
          onClick={e => { if (e.target === e.currentTarget) { setTestResult(null); setImageLoaded(false); } }}
        >
          <div style={{ display: "flex", minHeight: "100%", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem" }}>
            <div
              className="fade-up"
              style={{
                background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
                borderRadius: 20, backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.70)",
                position: "relative", width: "100%", maxWidth: 860,
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--color-glass-border)" }}>
                <div>
                  <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Diagnóstico IA</h2>
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 3 }}>Prueba SuperAdmin</p>
                </div>
                <button
                  onClick={() => { setTestResult(null); setImageLoaded(false); }}
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

              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div ref={diagContainerRef} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {testResult.imageBase64 ? (
                    <div style={{ borderRadius: 12, overflow: "hidden", position: "relative" }}>
                      {!imageLoaded && (
                        <div className="skeleton-shimmer" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 12 }} />
                      )}
                      <img
                        src={`data:image/png;base64,${testResult.imageBase64}`}
                        alt="Catálogo de estilos IA"
                        style={{ width: "100%", borderRadius: 12, display: imageLoaded ? "block" : "none" }}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageLoaded(true)}
                      />
                      {imageLoaded && testResult.styles?.slice(0, 4).map((s, i) => (
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
                          border: "3px solid white", background: "#a78bfa",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden", padding: 4,
                        }}>
                          <Scissors size={36} color="white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ borderRadius: 12, padding: 24, textAlign: "center", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: 0 }}>Imagen disponible solo con API de Gemini configurada</p>
                    </div>
                  )}

                  <DiagnosisInfographic data={testResult} clientPhotoUrl={testPreview} />
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleSaveDiagnosis}
                    disabled={savingDiag}
                    className="btn-primary"
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Sparkles size={14} /> {savingDiag ? "Guardando..." : savedMsg || "Guardar"}
                  </button>
                  {testResult.imageBase64 && (
                    <button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `data:image/png;base64,${testResult.imageBase64}`;
                        link.download = `diagnostico-ia-${new Date().toISOString().split("T")[0]}.png`;
                        link.click();
                      }}
                      className="btn-primary"
                      style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Download size={14} /> Descargar JPG
                    </button>
                  )}
                  <button
                    onClick={() => { setTestResult(null); setImageLoaded(false); setShowTestIA(true); resetTest(); }}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)", cursor: "pointer" }}
                  >
                    Otra foto
                  </button>
                </div>
                {savedMsg && <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: savedMsg.startsWith("✓") ? "#10b981" : "#f87171", margin: 0 }}>{savedMsg}</p>}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Diagnoses modal */}
      {diagTenant && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem", overflowY: "auto" }}>
          <div style={{
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            borderRadius: 20, padding: 0, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--color-glass-border)" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>Diagnósticos IA</h2>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0" }}>{diagTenant.name || diagTenant.id} — {diagnoses.length} registro{diagnoses.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setDiagTenant(null)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px 22px" }}>
              {diagLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--color-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                </div>
              ) : diagnoses.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13, padding: "40px 0" }}>No hay diagnósticos registrados.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {diagnoses.map(d => {
                    const date = d.appointmentDate.split("T")[0];
                    let imagePreview: string | null = null;
                    try {
                      const parsed = JSON.parse(d.aiDiagnosisJson);
                      if (parsed.imageBase64) imagePreview = `data:image/png;base64,${parsed.imageBase64}`;
                    } catch { /* */ }
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: "var(--color-surface)", border: "1px solid var(--color-glass-border)" }}>
                        {imagePreview ? (
                          <img src={imagePreview} alt="IA" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Sparkles size={18} style={{ color: "#a78bfa" }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.customerName}</p>
                          <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "2px 0 0" }}>{date}</p>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => handleDownloadDiagnosis(d)} title="Descargar" style={{ width: 30, height: 30, borderRadius: 7, border: "none", background: "rgba(16,185,129,0.1)", color: "#10b981", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(16,185,129,0.2)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(16,185,129,0.1)")}>
                            <Download size={13} />
                          </button>
                          <button onClick={() => handleDeleteDiagnosis(d.id)} title="Eliminar" style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 150ms" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")} onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: gestionar sedes */}
      {locationsTenant && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem" }}>
          <div style={{
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "85vh", display: "flex", flexDirection: "column",
            backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", boxShadow: "0 40px 100px rgba(0,0,0,0.70)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--color-glass-border)" }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", margin: 0 }}>Sedes</h2>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {locationsTenant.name || locationsTenant.id}
                </p>
              </div>
              <button
                onClick={closeLocationsModal}
                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 22px" }}>
              {locationsError && (
                <div style={{ borderRadius: 10, padding: "10px 14px", fontSize: 13, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171", marginBottom: 16 }}>
                  {locationsError}
                </div>
              )}

              {locationsLoading ? (
                <div style={{ textAlign: "center", padding: "30px 0" }}>
                  <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid var(--color-glass-border)", borderTopColor: "var(--color-primary)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                </div>
              ) : tenantLocations.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", padding: "20px 0", margin: "0 0 16px" }}>
                  Esta barbería no tiene sedes configuradas
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {tenantLocations.map(loc => (
                    <div key={loc.id} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      borderRadius: 12, background: "var(--color-surface)", border: "1px solid var(--color-glass-border)",
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: "color-mix(in srgb, var(--color-primary) 15%, transparent)", color: "var(--color-primary)",
                      }}>
                        <MapPin size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {loc.name}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {loc.address}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeleteLocationTarget(loc)}
                        style={{
                          flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                          border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#f87171",
                          transition: "background 150ms",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.15)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.06)")}
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Crear nueva sede */}
              <div style={{ borderTop: "1px solid var(--color-glass-border)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
                  Nueva sede
                </p>
                <div>
                  <label style={labelStyle}>Nombre de la sede</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={newLocationName}
                    onChange={e => setNewLocationName(e.target.value)}
                    placeholder="Sede Centro"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Dirección</label>
                  <input
                    type="text"
                    maxLength={256}
                    value={newLocationAddress}
                    onChange={e => setNewLocationAddress(e.target.value)}
                    placeholder="Calle 10 #5-20"
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
                  />
                </div>
                <button
                  onClick={handleCreateLocation}
                  disabled={creatingLocation || !newLocationName.trim() || !newLocationAddress.trim()}
                  className="btn-primary"
                  style={{
                    padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "none",
                    cursor: (creatingLocation || !newLocationName.trim() || !newLocationAddress.trim()) ? "not-allowed" : "pointer",
                    opacity: (creatingLocation || !newLocationName.trim() || !newLocationAddress.trim()) ? 0.6 : 1,
                  }}
                >
                  <Plus size={14} /> {creatingLocation ? "Agregando..." : "Agregar sede"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmación: eliminar sede — por encima del modal de sedes (z-index mayor) */}
      {deleteLocationTarget && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem" }}>
          <div style={{
            background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
            borderRadius: 20, padding: 28, width: "100%", maxWidth: 380,
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", textAlign: "center", margin: "0 0 8px" }}>
              ¿Eliminar esta sede?
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", margin: "0 0 24px" }}>
              Los barberos asignados quedarán sin sede.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteLocationTarget(null)}
                disabled={!!deletingLocationId}
                style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: deletingLocationId ? "not-allowed" : "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteLocation}
                disabled={!!deletingLocationId}
                style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", cursor: deletingLocationId ? "not-allowed" : "pointer" }}
              >
                {deletingLocationId ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .sa-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .sa-tenant-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
        @media (max-width: 768px) {
          .sa-stats-grid { grid-template-columns: 1fr; }
          .sa-tenant-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

/* ── Helpers ────────────────────────────────────────────── */

const CredentialRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 13, color: "var(--color-text)", margin: "2px 0 0", wordBreak: "break-all", fontFamily: mono ? "monospace" : undefined, fontWeight: mono ? 700 : 600 }}>{value}</p>
      </div>
      <button
        onClick={copy}
        style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
          fontSize: 11, padding: "4px 10px", borderRadius: 8, fontWeight: 600,
          border: "1px solid var(--color-glass-border)", background: "transparent",
          color: "var(--color-text-muted)", cursor: "pointer", transition: "color 150ms ease",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--color-text)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--color-text-muted)")}
      >
        {copied ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Copiar</>}
      </button>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "var(--color-surface)",
  border: "1px solid var(--color-border)", borderRadius: 10, color: "var(--color-text)",
  fontSize: 13, outline: "none", boxSizing: "border-box", transition: "border-color 150ms",
};

const FormField = ({ label, name, value, onChange, type = "text", required = false, placeholder = "" }: {
  label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; required?: boolean; placeholder?: string;
}) => (
  <div>
    <label style={labelStyle}>{label}</label>
    <input name={name} type={type} value={value} onChange={onChange} required={required} placeholder={placeholder}
      style={inputStyle}
      onFocus={e => (e.currentTarget.style.borderColor = "var(--color-primary)")}
      onBlur={e => (e.currentTarget.style.borderColor = "var(--color-border)")}
    />
  </div>
);

const ConfirmModal = ({ title, subtitle, description, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string; subtitle?: React.ReactNode; description: string;
  confirmLabel: string; confirmColor: string; onConfirm: () => void; onCancel: () => void;
}) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", padding: "1rem" }}>
    <div style={{
      background: "var(--color-glass-surface)", border: "1px solid var(--color-glass-border)",
      borderRadius: 20, padding: 28, width: "100%", maxWidth: 380,
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", textAlign: "center", margin: "0 0 8px" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", margin: "0 0 8px" }}>{subtitle}</p>}
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", margin: "0 0 24px" }}>{description}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 600, borderRadius: 10, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
        >Cancelar</button>
        <button onClick={onConfirm}
          style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "none", background: confirmColor, color: "#fff", cursor: "pointer" }}
        >{confirmLabel}</button>
      </div>
    </div>
  </div>
);
