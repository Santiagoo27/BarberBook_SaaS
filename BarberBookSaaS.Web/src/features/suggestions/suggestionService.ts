import apiClient from "../../api/apiClient";

export interface Suggestion {
  id: string;
  customerName: string;
  type: "queja" | "sugerencia";
  message: string;
  status: "Pendiente" | "Leída";
  createdAt: string;
}

export const suggestionService = {
  getAll: async (): Promise<Suggestion[]> => {
    const r = await apiClient.get<Suggestion[]>("/api/suggestions");
    return r.data;
  },
  markAsRead: async (id: string): Promise<void> => {
    await apiClient.put(`/api/suggestions/${id}/read`);
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/suggestions/${id}`);
  },
};
