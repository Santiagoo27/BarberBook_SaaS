import publicApiClient from "../../api/publicApiClient";
import type {
  AvailabilitySlot,
  BookingConfirmation,
  CustomerAppointment,
  CustomerAuth,
  CustomerMe,
  PublicBarber,
  PublicBranding,
  PublicLocation,
  PublicService,
  RescheduleResult,
  TokenAppointment,
} from "./bookingTypes";

export const bookingService = {
  getBranding: async (subdomain: string): Promise<PublicBranding> => {
    const r = await publicApiClient.get<PublicBranding>(
      `/api/public/${subdomain}/branding`
    );
    return r.data;
  },

  getHolidays: async (subdomain: string, year?: number): Promise<{ enabled: boolean; holidays: string[] }> => {
    const params = year ? { year } : {};
    const r = await publicApiClient.get<{ enabled: boolean; holidays: string[] }>(
      `/api/public/${subdomain}/holidays`,
      { params }
    );
    return r.data;
  },

  getServices: async (subdomain: string, locationId?: string): Promise<PublicService[]> => {
    const r = await publicApiClient.get<PublicService[]>(
      `/api/public/${subdomain}/services`,
      { params: locationId ? { locationId } : undefined }
    );
    return r.data;
  },

  getBarbers: async (subdomain: string, locationId?: string): Promise<PublicBarber[]> => {
    const r = await publicApiClient.get<PublicBarber[]>(
      `/api/public/${subdomain}/barbers`,
      { params: locationId ? { locationId } : undefined }
    );
    return r.data;
  },

  getLocations: async (subdomain: string): Promise<PublicLocation[]> => {
    const r = await publicApiClient.get<PublicLocation[]>(
      `/api/public/${subdomain}/locations`
    );
    return r.data;
  },

  getAvailability: async (
    subdomain: string,
    barberId: string,
    serviceId: string,
    date: string,
    excludeAppointmentId?: string,
    locationId?: string
  ): Promise<AvailabilitySlot[]> => {
    const r = await publicApiClient.get<AvailabilitySlot[]>(
      `/api/public/${subdomain}/availability`,
      { params: { barberId, serviceId, date, excludeAppointmentId, locationId } }
    );
    return r.data;
  },

  loginCustomer: async (
    subdomain: string,
    phone: string,
    password: string
  ): Promise<CustomerAuth> => {
    const r = await publicApiClient.post<CustomerAuth>(
      `/api/public/${subdomain}/auth/login`,
      { phone, password }
    );
    return r.data;
  },

  registerCustomer: async (
    subdomain: string,
    name: string,
    phone: string,
    password: string
  ): Promise<CustomerAuth> => {
    const r = await publicApiClient.post<CustomerAuth>(
      `/api/public/${subdomain}/auth/register`,
      { name, phone, password }
    );
    return r.data;
  },

  createAppointment: async (
    subdomain: string,
    barberId: string,
    serviceId: string,
    appointmentDate: string,
    locationId?: string
  ): Promise<BookingConfirmation> => {
    const r = await publicApiClient.post<BookingConfirmation>(
      `/api/public/${subdomain}/appointments`,
      { barberId, serviceId, appointmentDate, locationId }
    );
    return r.data;
  },

  getCustomerAppointments: async (): Promise<CustomerAppointment[]> => {
    const r = await publicApiClient.get<CustomerAppointment[]>(
      "/api/customer/appointments"
    );
    return r.data;
  },

  cancelAppointment: async (subdomain: string, appointmentId: string): Promise<void> => {
    await publicApiClient.delete(`/api/public/${subdomain}/appointments/${appointmentId}`);
  },

  rescheduleAppointment: async (
    subdomain: string,
    appointmentId: string,
    newAppointmentDate: string
  ): Promise<RescheduleResult> => {
    const r = await publicApiClient.put<RescheduleResult>(
      `/api/public/${subdomain}/appointments/${appointmentId}/reschedule`,
      { newAppointmentDate }
    );
    return r.data;
  },

  forgotPasswordCustomer: async (subdomain: string, phone: string): Promise<void> => {
    await publicApiClient.post(`/api/public/${subdomain}/auth/forgot-password`, { phone });
  },

  resetPasswordCustomer: async (subdomain: string, token: string, newPassword: string): Promise<void> => {
    await publicApiClient.post(`/api/public/${subdomain}/auth/reset-password`, { token, newPassword });
  },

  getCustomerMe: async (): Promise<CustomerMe> => {
    const r = await publicApiClient.get<CustomerMe>("/api/customer/me");
    return r.data;
  },

  getAppointmentByToken: async (token: string): Promise<TokenAppointment> => {
    const r = await publicApiClient.get<TokenAppointment>(`/api/public/reschedule/${token}`);
    return r.data;
  },

  rescheduleAppointmentByToken: async (
    token: string,
    newAppointmentDate: string
  ): Promise<RescheduleResult> => {
    const r = await publicApiClient.put<RescheduleResult>(
      `/api/public/reschedule/${token}`,
      { newAppointmentDate }
    );
    return r.data;
  },
};
