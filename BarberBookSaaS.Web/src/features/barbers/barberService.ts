import apiClient from "../../api/apiClient";
import type { Barber, BarberRequest, CreateBarberResponse, BarberScheduleEntry, BarberScheduleRequest } from "./barberTypes";

export const barberService = {
  getMe: async (): Promise<{ id: string; name: string; email: string; phone: string; specialty: string; imageBase64?: string }> => {
    const response = await apiClient.get("/api/barbers/me");
    return response.data;
  },

  getAll: async (): Promise<Barber[]> => {
    const response = await apiClient.get<Barber[]>("/api/barbers");
    return response.data;
  },

  create: async (data: BarberRequest): Promise<CreateBarberResponse> => {
    const response = await apiClient.post<CreateBarberResponse>("/api/barbers", data);
    return response.data;
  },

  update: async (id: string, data: BarberRequest): Promise<Barber> => {
    const response = await apiClient.put<Barber>(`/api/barbers/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ cancelledAppointments: number }> => {
    const response = await apiClient.delete<{ cancelledAppointments: number }>(`/api/barbers/${id}`);
    return response.data;
  },

  getSchedule: async (id: string): Promise<BarberScheduleEntry[]> => {
    const response = await apiClient.get<BarberScheduleEntry[]>(`/api/barbers/${id}/schedule`);
    return response.data;
  },

  upsertScheduleDay: async (id: string, data: BarberScheduleRequest): Promise<void> => {
    await apiClient.post(`/api/barbers/${id}/schedule`, data);
  },

  deleteScheduleDay: async (id: string, day: number): Promise<void> => {
    await apiClient.delete(`/api/barbers/${id}/schedule/${day}`);
  },

  activate: async (id: string): Promise<Barber> => {
    const response = await apiClient.put<Barber>(`/api/barbers/${id}/activate`);
    return response.data;
  },

  hardDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/barbers/${id}/permanent`);
  },

  uploadImage: async (id: string, file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    // apiClient fija Content-Type: application/json por defecto — debe quitarse
    // para que el navegador genere el boundary de multipart/form-data
    const response = await apiClient.post<{ imageBase64: string }>(`/api/barbers/${id}/image`, fd, {
      headers: { "Content-Type": undefined },
    });
    return response.data.imageBase64;
  },
};
