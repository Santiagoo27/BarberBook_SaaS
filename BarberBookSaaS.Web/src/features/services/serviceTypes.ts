export interface Service {
  id: string;
  tenantId: string;
  name: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  imageBase64?: string | null;
}

export interface ServiceRequest {
  name: string;
  price: number;
  durationMinutes: number;
}