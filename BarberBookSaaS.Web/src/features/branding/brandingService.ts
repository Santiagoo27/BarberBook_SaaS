import apiClient from "../../api/apiClient";
import type { TenantBranding, UpdateBrandingDto } from "./brandingTypes";

export const brandingService = {
  getBranding: async (): Promise<TenantBranding> => {
    const r = await apiClient.get<TenantBranding>("/api/tenant/branding");
    return r.data;
  },

  updateBranding: async (data: UpdateBrandingDto): Promise<TenantBranding> => {
    const r = await apiClient.put<TenantBranding>("/api/tenant/branding", data);
    return r.data;
  },

  uploadLogo: async (file: File): Promise<void> => {
    const fd = new FormData();
    fd.append("file", file);
    // apiClient fija Content-Type: application/json por defecto — debe quitarse
    // para que el navegador genere el boundary de multipart/form-data
    await apiClient.post("/api/tenant/logo", fd, {
      headers: { "Content-Type": undefined },
    });
  },

  updateWhatsApp: async (enabled: boolean, phone: string): Promise<void> => {
    await apiClient.put("/api/tenant/whatsapp", { enabled, phone });
  },

  updateHolidays: async (enabled: boolean): Promise<void> => {
    await apiClient.put("/api/tenant/holidays", { enabled });
  },

  updateAddress: async (address: string): Promise<void> => {
    await apiClient.put("/api/tenant/address", { address });
  },

  updateName: async (name: string): Promise<void> => {
    await apiClient.put("/api/tenant/name", { name });
  },
};
