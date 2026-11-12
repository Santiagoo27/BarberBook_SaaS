import apiClient from "../../api/apiClient";
import type { CustomersPagedResult, LoyaltyConfig } from "./customerTypes";

export const customerService = {
  getAll: async (page = 1, pageSize = 100): Promise<CustomersPagedResult> => {
    const res = await apiClient.get<CustomersPagedResult>("/api/customers", {
      params: { page, pageSize },
    });
    return res.data;
  },

  getLoyaltyConfig: async (): Promise<LoyaltyConfig> => {
    const res = await apiClient.get<LoyaltyConfig>("/api/tenant/loyalty");
    return res.data;
  },

  awardPoints: async (customerId: string, points: number): Promise<void> => {
    await apiClient.post("/api/tenant/loyalty/award", { customerId, points });
  },

  updateLoyaltyConfig: async (enabled: boolean, threshold: number, rewardServiceId: string | null): Promise<void> => {
    await apiClient.put("/api/tenant/loyalty", { enabled, threshold, rewardServiceId });
  },
};