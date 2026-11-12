import apiClient from "../../api/apiClient";

export interface DailyRevenue {
  day: string;
  date: string;
  revenue: number;
  appointments: number;
}

export interface DashboardStats {
  todayAppointments: number;
  todayRevenue: number;
  pendingAppointments: number;
  totalActiveBarbers: number;
  busiestBarber: { name: string; appointmentsToday: number } | null;
  upcomingAppointments: number;
  weekRevenue: number;
  todayWalkIns: number;
  totalWalkIns: number;
}

export interface PeriodStats {
  totalAppointments: number;
  totalRevenue: number;
  newCustomers: number;
  totalWalkIns: number;
}

export interface BarberEarnings {
  barberId: string;
  barberName: string;
  revenue: number;
  completedAppointments: number;
}

export const dashboardService = {
  getStats: async (locationId?: string | null): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>("/api/dashboard/stats", {
      params: locationId ? { locationId } : undefined,
    });
    return response.data;
  },

  getWeeklyRevenue: async (locationId?: string | null, days = 7): Promise<DailyRevenue[]> => {
    const params: Record<string, unknown> = { days };
    if (locationId) params.locationId = locationId;
    const response = await apiClient.get<DailyRevenue[]>("/api/dashboard/weekly-revenue", { params });
    return response.data;
  },

  getPeriodStats: async (days: number, locationId?: string | null): Promise<PeriodStats> => {
    const params: Record<string, unknown> = { days };
    if (locationId) params.locationId = locationId;
    const response = await apiClient.get<PeriodStats>("/api/dashboard/period-stats", { params });
    return response.data;
  },

  getBarberEarnings: async (days: number, locationId?: string | null): Promise<BarberEarnings[]> => {
    const params: Record<string, unknown> = { days };
    if (locationId) params.locationId = locationId;
    const response = await apiClient.get<BarberEarnings[]>("/api/dashboard/barber-earnings", { params });
    return response.data;
  },
};
