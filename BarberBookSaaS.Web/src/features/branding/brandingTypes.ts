export interface TenantBranding {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  logoBase64?: string;
  name?: string;
  address?: string;
  plan?: string;
  whatsAppEnabled?: boolean;
  whatsAppPhone?: string;
  holidaysEnabled?: boolean;
}

export interface UpdateBrandingDto {
  theme: string;
  primaryColor: string;
  secondaryColor: string;
}
