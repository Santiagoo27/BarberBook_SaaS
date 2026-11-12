import apiClient from "../../api/apiClient";
import type { Appointment, AppointmentRequest, AppointmentStatus, PagedResult, TimeSlot } from "./appointmentTypes";

const todayDateRange = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return { from: `${d}T00:00:00`, to: `${d}T23:59:59` };
};

export const appointmentService = {
  getAll: async (): Promise<Appointment[]> => {
    const response = await apiClient.get<PagedResult<Appointment>>("/api/appointments");
    return response.data.data;
  },

  getToday: async (): Promise<Appointment[]> => {
    const { from, to } = todayDateRange();
    const response = await apiClient.get<PagedResult<Appointment>>("/api/appointments", {
      params: { from, to, pageSize: 100 },
    });
    return response.data.data;
  },

  getThisWeek: async (): Promise<Appointment[]> => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const from = `${fmt(startOfWeek)}T00:00:00`;
    const to = `${fmt(endOfWeek)}T23:59:59`;
    const response = await apiClient.get<PagedResult<Appointment>>("/api/appointments", {
      params: { from, to, pageSize: 200 },
    });
    return response.data.data;
  },

  getWeek: async (): Promise<Appointment[]> => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const from = `${fmt(now)}T00:00:00`;
    const end = new Date(now);
    end.setDate(end.getDate() + 13);
    const to = `${fmt(end)}T23:59:59`;
    const response = await apiClient.get<PagedResult<Appointment>>("/api/appointments", {
      params: { from, to, pageSize: 200 },
    });
    return response.data.data;
  },

  create: async (data: AppointmentRequest): Promise<Appointment> => {
    const response = await apiClient.post<Appointment>("/api/appointments", data);
    return response.data;
  },

  updateStatus: async (id: string, status: AppointmentStatus): Promise<Appointment> => {
    const response = await apiClient.put<Appointment>(`/api/appointments/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/appointments/${id}`);
  },

  bulkDelete: async (ids: string[]): Promise<number> => {
    const r = await apiClient.delete<{ deleted: number }>("/api/appointments/bulk", { data: { ids } });
    return r.data.deleted;
  },

  getAvailability: async (barberId: string, serviceId: string, date: string): Promise<TimeSlot[]> => {
    const response = await apiClient.get<TimeSlot[]>("/api/appointments/availability", {
      params: { barberId, serviceId, date },
    });
    return response.data;
  },

  createWalkIn: async (data: { serviceId: string; customerName: string; customerPhone?: string; appointmentDate?: string }): Promise<Appointment> => {
    const response = await apiClient.post<Appointment>("/api/appointments/walk-in", data);
    return response.data;
  },
};
