import apiClient from "../../api/apiClient";
import type { LoginRequest, AuthResponse, TenantLookupResult } from "./authTypes";

export const authService = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/api/auth/login", credentials);
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>("/api/auth/change-password", { currentPassword, newPassword });
    return response.data;
  },

  lookupTenantByEmail: async (email: string): Promise<TenantLookupResult> => {
    const response = await apiClient.get<TenantLookupResult>("/api/auth/tenant-by-email", {
      params: { email },
    });
    return response.data;
  },
};