export type AppointmentStatus = "Pendiente" | "Completada" | "Cancelada";

export interface Appointment {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string | null;
  appointmentDate: string;
  status: AppointmentStatus;
  createdAt: string;
  cancelledBy?: string | null;
  barber?: { id: string; name: string };
  service?: { id: string; name: string; price: number; durationMinutes: number };
  customerLoyaltyCount?: number | null;
  customerLoyaltyThreshold?: number | null;
  customerLoyaltyEnabled?: boolean | null;
  isWalkIn?: boolean;
  locationId?: string | null;
}

export interface AppointmentRequest {
  barberId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  appointmentDate: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
