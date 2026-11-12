export interface PublicBranding {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
  name?: string;
  address?: string;
  plan?: string;
}

export interface PublicService {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  imageBase64?: string;
}

export interface PublicBarber {
  id: string;
  name: string;
  specialty?: string;
  imageBase64?: string;
}

export interface PublicLocation {
  id: string;
  name: string;
  address: string;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface CustomerAuth {
  token: string;
  refreshToken: string;
  expiresAt: string;
  customerId: string;
  name: string;
  phone: string;
  tenantId: string;
  loyaltyCount: number;
}

export interface BookingConfirmation {
  appointmentId: string;
  barberId: string;
  serviceId: string;
  appointmentDate: string;
  status: string;
  isFree: boolean;
  loyaltyCount: number;
}

export interface CustomerAppointment {
  id: string;
  barberId: string;
  serviceId: string;
  barberName: string;
  serviceName: string;
  servicePrice: number;
  appointmentDate: string;
  status: string;
  isFree: boolean;
  cancelledBy?: string;
  wasRescheduled: boolean;
}

export interface CustomerMe {
  name: string;
  phone: string;
  loyaltyCount: number;
  loyaltyThreshold: number;
  loyaltyEnabled: boolean;
  loyaltyRewardServiceId: string | null;
  loyaltyRewardServiceName: string | null;
}

export interface RescheduleResult {
  appointmentId: string;
  appointmentDate: string;
  status: string;
  message: string;
}

export interface TokenAppointment {
  subdomain: string;
  tenantName?: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
  logoUrl?: string;
  appointmentId: string;
  barberId: string;
  serviceId: string;
  barberName: string;
  serviceName: string;
  appointmentDate: string; // ISO 8601
  status: string;
  canReschedule: boolean;
}
