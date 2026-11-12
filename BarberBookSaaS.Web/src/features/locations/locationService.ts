import apiClient from "../../api/apiClient";
import type { LocationDto, LocationDetailDto, UpdateLocationDto } from "./locationTypes";

export const locationService = {
  getLocations: async (): Promise<LocationDto[]> => {
    const response = await apiClient.get<LocationDto[]>("/api/locations");
    return response.data;
  },

  getLocationDetail: async (id: string): Promise<LocationDetailDto> => {
    const response = await apiClient.get<LocationDetailDto>(`/api/locations/${id}`);
    return response.data;
  },

  updateLocation: async (id: string, dto: UpdateLocationDto): Promise<LocationDto> => {
    const response = await apiClient.put<LocationDto>(`/api/locations/${id}`, dto);
    return response.data;
  },

  assignBarber: async (locationId: string, barberId: string): Promise<void> => {
    await apiClient.post(`/api/locations/${locationId}/barbers`, { barberId });
  },

  removeBarber: async (locationId: string, barberId: string): Promise<void> => {
    await apiClient.delete(`/api/locations/${locationId}/barbers/${barberId}`);
  },

  assignService: async (locationId: string, serviceId: string): Promise<void> => {
    await apiClient.post(`/api/locations/${locationId}/services`, { serviceId });
  },

  removeService: async (locationId: string, serviceId: string): Promise<void> => {
    await apiClient.delete(`/api/locations/${locationId}/services/${serviceId}`);
  },
};
