export interface Barber {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  isActive: boolean;
  tenantId: string;
  userId?: string;
  imageBase64?: string | null;
  locationId?: string | null;
}

export interface BarberRequest {
  name: string;
  email: string;
  phone: string;
  specialty: string;
}

export interface BarberScheduleEntry {
  id: string;
  barberId: string;
  dayOfWeek: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  breakStartHour?: number | null;
  breakStartMinute?: number | null;
  breakEndHour?: number | null;
  breakEndMinute?: number | null;
}

export interface BarberScheduleRequest {
  dayOfWeek: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  breakStartHour?: number | null;
  breakStartMinute?: number | null;
  breakEndHour?: number | null;
  breakEndMinute?: number | null;
}

export interface CreateBarberResponse {
  barber: Barber;
  temporaryPassword: string;
}
