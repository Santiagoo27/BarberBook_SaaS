import apiClient from "../../api/apiClient";
import type { LocationDto } from "../locations/locationTypes";

export interface TenantSummary {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  theme?: string;
  adminEmail: string;
  totalAppointments: number;
  totalBarbers: number;
  totalDiagnoses: number;
  plan: string;
  isWebActive: boolean;
  createdAt: string;
  currentPeriodStart: string;
  diagnosisRemaining: number; // -2=Standard (N/A), -1=PremiumUnlimited, 0-100=restantes
}

export interface CreateTenantForm {
  barberiaName: string;
  subdomain: string;
  phone: string;
  address: string;
  adminEmail: string;
}

export interface SavedDiagnosis {
  id: string;
  label: string;
  createdAt: string;
}

export interface DiagnosisRecord {
  id: string;
  customerName: string;
  appointmentDate: string;
  aiDiagnosisJson: string;
}

export const superAdminService = {
  listTenants: async (): Promise<TenantSummary[]> => {
    const r = await apiClient.get<TenantSummary[]>("/api/superadmin/tenants");
    return r.data;
  },
  createTenant: async (data: CreateTenantForm): Promise<{ temporaryPassword: string }> => {
    const r = await apiClient.post<{ temporaryPassword: string }>("/api/superadmin/tenants", data);
    return r.data;
  },
  updatePlan: async (tenantId: string, plan: string): Promise<void> => {
    await apiClient.put(`/api/superadmin/tenants/${tenantId}/plan`, { plan });
  },
  updateStatus: async (tenantId: string, isWebActive: boolean): Promise<void> => {
    await apiClient.put(`/api/superadmin/tenants/${tenantId}/status`, { isWebActive });
  },
  deleteTenant: async (tenantId: string): Promise<void> => {
    await apiClient.delete(`/api/superadmin/tenants/${tenantId}`);
  },
  getDiagnoses: async (tenantId: string): Promise<DiagnosisRecord[]> => {
    const r = await apiClient.get<DiagnosisRecord[]>(`/api/superadmin/tenants/${tenantId}/diagnoses`);
    return r.data;
  },
  deleteDiagnosis: async (appointmentId: string): Promise<void> => {
    await apiClient.delete(`/api/superadmin/diagnoses/${appointmentId}`);
  },
  testDiagnosis: async (imageBase64: string): Promise<unknown> => {
    const r = await apiClient.post("/api/superadmin/test-diagnosis", { imageBase64 }, { timeout: 120_000 });
    return r.data;
  },
  getMyDiagnoses: async (): Promise<SavedDiagnosis[]> => {
    const r = await apiClient.get<SavedDiagnosis[]>("/api/superadmin/my-diagnoses");
    return r.data;
  },
  getMyDiagnosis: async (id: string): Promise<unknown> => {
    const r = await apiClient.get(`/api/superadmin/my-diagnoses/${id}`);
    return r.data;
  },
  saveMyDiagnosis: async (label: string, resultJson: string): Promise<{ id: string }> => {
    const r = await apiClient.post<{ id: string }>("/api/superadmin/my-diagnoses", { label, resultJson });
    return r.data;
  },
  deleteMyDiagnosis: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/superadmin/my-diagnoses/${id}`);
  },

  // Sedes de una barbería específica — el SuperAdmin actúa "en nombre" del
  // tenant sobreescribiendo X-Tenant-Id por request, sin cambiar su propia sesión.
  getLocationsForTenant: async (tenantId: string): Promise<LocationDto[]> => {
    const r = await apiClient.get<LocationDto[]>("/api/locations", {
      headers: { "X-Tenant-Id": tenantId },
    });
    return r.data;
  },
  createLocationForTenant: async (tenantId: string, data: { name: string; address: string }): Promise<LocationDto> => {
    const r = await apiClient.post<LocationDto>("/api/locations", data, {
      headers: { "X-Tenant-Id": tenantId },
    });
    return r.data;
  },
  deleteLocationForTenant: async (tenantId: string, locationId: string): Promise<void> => {
    await apiClient.delete(`/api/locations/${locationId}`, {
      headers: { "X-Tenant-Id": tenantId },
    });
  },
};
