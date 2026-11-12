import apiClient from "../../api/apiClient";
import type { Service, ServiceRequest } from "./serviceTypes";

export const serviceService = {
  getAll: async (): Promise<Service[]> => {
    const response = await apiClient.get<Service[]>("/api/services");
    return response.data;
  },

  create: async (data: ServiceRequest): Promise<Service> => {
    const response = await apiClient.post<Service>("/api/services", data);
    return response.data;
  },

  update: async (id: string, data: ServiceRequest): Promise<Service> => {
    const response = await apiClient.put<Service>(`/api/services/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<{ cancelledAppointments: number }> => {
    const response = await apiClient.delete<{ cancelledAppointments: number }>(`/api/services/${id}`);
    return response.data;
  },

  activate: async (id: string): Promise<Service> => {
    const response = await apiClient.put<Service>(`/api/services/${id}/activate`);
    return response.data;
  },

  hardDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/services/${id}/permanent`);
  },

  uploadImage: async (id: string, file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    // apiClient fija Content-Type: application/json por defecto — debe quitarse
    // para que el navegador genere el boundary de multipart/form-data
    const response = await apiClient.post<{ imageBase64: string }>(`/api/services/${id}/image`, fd, {
      headers: { "Content-Type": undefined },
    });
    return response.data.imageBase64;
  },
};