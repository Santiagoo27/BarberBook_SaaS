using BarberBookSaaS.Application.DTOs.Dashboard;

namespace BarberBookSaaS.Application.Common;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetStatsAsync(Guid? filterByUserId = null, Guid? locationId = null);
    Task<List<DailyRevenueDto>> GetWeeklyRevenueAsync(Guid? locationId = null, int days = 7);
    Task<PeriodStatsDto> GetPeriodStatsAsync(int days, Guid? locationId = null);
    Task<List<BarberEarningsDto>> GetBarberEarningsAsync(int days, Guid? locationId = null);
}