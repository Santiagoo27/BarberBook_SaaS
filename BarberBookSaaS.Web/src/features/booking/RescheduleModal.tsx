import { createPortal } from "react-dom";
import { bookingService } from "./bookingService";
import { RescheduleForm } from "./RescheduleForm";
import type { CustomerAppointment } from "./bookingTypes";

const BACKDROP_SCROLL: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", overflowY: "auto",
};
const PANEL: React.CSSProperties = {
  background: "var(--color-glass-surface)",
  border: "1px solid var(--color-glass-border)",
  backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
  boxShadow: "0 40px 100px rgba(0,0,0,0.70)", borderRadius: "20px",
};

interface RescheduleModalProps {
  subdomain: string;
  appointment: CustomerAppointment;
  primaryColor: string;
  onClose: () => void;
  onRescheduled: () => void;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  subdomain, appointment, primaryColor, onClose, onRescheduled,
}) => {
  return createPortal(
    <div style={BACKDROP_SCROLL}>
      <div style={{ display: "flex", minHeight: "100%", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div className="fade-up" style={{ ...PANEL, width: "100%", maxWidth: "420px", padding: "28px" }}>
          <h3 style={{ color: "var(--color-text)", fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "4px" }}>
            Reprogramar cita
          </h3>
          <p style={{ color: "var(--color-text-muted)", fontSize: "12px", marginBottom: "20px" }}>
            {appointment.serviceName} con {appointment.barberName}
          </p>
          <RescheduleForm
            subdomain={subdomain}
            barberId={appointment.barberId}
            serviceId={appointment.serviceId}
            appointmentId={appointment.id}
            currentAppointmentDate={appointment.appointmentDate}
            primaryColor={primaryColor}
            onCancel={onClose}
            onSubmit={async (newDateIso) => {
              try {
                await bookingService.rescheduleAppointment(subdomain, appointment.id, newDateIso);
                onRescheduled();
                onClose();
              } catch (e: unknown) {
                const err = e as { response?: { data?: { message?: string } } };
                throw new Error(err?.response?.data?.message ?? "No se pudo reprogramar la cita.");
              }
            }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};
