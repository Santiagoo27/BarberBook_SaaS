export interface LocationDto {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
  barberCount: number;
  serviceCount: number;
}

export interface BarberSummaryDto {
  id: string;
  name: string;
  specialty: string;
  imageBase64?: string | null;
}

export interface ServiceSummaryDto {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface LocationDetailDto extends LocationDto {
  barbers: BarberSummaryDto[];
  services: ServiceSummaryDto[];
}

export interface UpdateLocationDto {
  name: string;
  address: string;
}
