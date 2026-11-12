import { useEffect, useState } from "react";
import { bookingService } from "./bookingService";
import type { AvailabilitySlot } from "./bookingTypes";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface RescheduleFormProps {
  subdomain: string;
  barberId: string;
  serviceId: string;
  appointmentId: string;
  currentAppointmentDate: string; // ISO 8601
  primaryColor: string;
  /** Must reject with `new Error(userFacingMessage)` on failure */
  onSubmit: (newAppointmentDateIso: string) => Promise<void>;
  /** If provided, renders a "Cancelar" button alongside "Confirmar" */
  onCancel?: () => void;
}

export const RescheduleForm: React.FC<RescheduleFormProps> = ({
  subdomain, barberId, serviceId, appointmentId,
  currentAppointmentDate: _currentAppointmentDate, primaryColor, onSubmit, onCancel,
}) => {
  const now            = new Date();
  const minDateStr     = dateStr(now);

  const [selectedDate, setSelectedDate] = useState(minDateStr);
  const [slots, setSlots]               = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState("");

  useEffect(() => {
    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlot("");
    bookingService
      .getAvailability(subdomain, barberId, serviceId, selectedDate, appointmentId)
      .then((data) => {
        if (cancelled) return;
        const nowTime = timeStr(new Date());
        const filtered = selectedDate === dateStr(new Date())
          ? data.filter((s) => s.time > nowTime)
          : data;
        setSlots(filtered);
      })
      .catch(() => { if (!cancelled) setSlots([]); })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [subdomain, barberId, serviceId, appointmentId, selectedDate]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit(`${selectedDate}T${selectedSlot}:00`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo reprogramar la cita.");
    } finally {
      setSubmitting(false);
    }
  };

  const dayName = DAY_NAMES[new Date(`${selectedDate}T12:00:00`).getDay()];

  return (
    <>
      {error && (
        <div style={{
          marginBottom: "16px", borderRadius: "10px", padding: "12px",
          fontSize: "12px", lineHeight: 1.5,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", color: "#f87171",
        }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 8 }}>
          Nueva fecha
        </label>
        <input
          type="date"
          min={minDateStr}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input-theme"
          style={{ width: "100%", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 12 }}>
          {slotsLoading ? "Cargando horarios…" : `Horarios disponibles — ${dayName}`}
        </p>
        {slotsLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "2px solid var(--color-glass-border)",
              borderTopColor: primaryColor,
              animation: "booking-spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes booking-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : slots.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            No hay horarios disponibles para este día.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.time;
              return (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.time)}
                  style={{
                    padding: "9px 4px", borderRadius: 8,
                    fontSize: 13, fontWeight: isSelected ? 600 : 500,
                    cursor: slot.available ? "pointer" : "not-allowed",
                    transition: "all 150ms ease",
                    background: isSelected ? primaryColor : "var(--color-surface)",
                    border: `1.5px solid ${isSelected ? primaryColor : "var(--color-border)"}`,
                    color: isSelected ? "#000" : slot.available ? "var(--color-text)" : "var(--color-text-muted)",
                    opacity: slot.available ? 1 : 0.3,
                  }}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost"
            style={{ flex: 1, padding: "10px 0", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={!selectedSlot || submitting}
          className="btn-primary"
          style={{
            flex: 1, padding: "10px 0", borderRadius: "10px",
            fontSize: "13px", fontWeight: 700, border: "none",
            cursor: !selectedSlot || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Reprogramando…" : "Confirmar nuevo horario"}
        </button>
      </div>
    </>
  );
};
