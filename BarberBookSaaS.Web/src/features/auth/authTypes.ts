export interface LoginRequest {
  email: string;       // Cambiado de 'correo' (Verifica si en Swagger pide 'adminEmail')
  password: string;    // Cambiado de 'contrasena' (Verifica si en Swagger pide 'adminPassword')
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
  tenantId: string;
  userId: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export interface TenantLookupResult {
  tenantId: string;
  tenantName: string;
  logoBase64?: string | null;
}