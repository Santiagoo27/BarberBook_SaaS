using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Dashboard;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public DashboardService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<DashboardStatsDto> GetStatsAsync(Guid? filterByUserId = null, Guid? locationId = null)
    {
        if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
            throw new InvalidOperationException("TenantId not resolved for dashboard query.");

        var colombiaOffset = TimeSpan.FromHours(-5);
        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
        var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
        var tomorrow = today.AddDays(1);
        var now = DateTime.SpecifyKind(colombiaNow, DateTimeKind.Utc);

        var todayQuery = _context.Appointments
            .Include(a => a.Service)
            .Include(a => a.Barber)
            .Where(a => a.AppointmentDate >= today && a.AppointmentDate < tomorrow);

        if (filterByUserId.HasValue)
            todayQuery = todayQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

        if (locationId.HasValue)
            todayQuery = todayQuery.Where(a => a.LocationId == locationId.Value);

        var todayAppointments = await todayQuery.ToListAsync();

        var todayCount = todayAppointments.Count(a => a.Status != AppointmentStatus.Cancelled);

        var todayRevenue = (decimal)todayAppointments
            .Where(a => a.Status == AppointmentStatus.Completed && a.Service != null)
            .Sum(a => (double)a.Service!.Price);

        var pendingQuery = _context.Appointments
            .Where(a => a.Status == AppointmentStatus.Pending);

        if (filterByUserId.HasValue)
            pendingQuery = pendingQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

        if (locationId.HasValue)
            pendingQuery = pendingQuery.Where(a => a.LocationId == locationId.Value);

        var pendingCount = await pendingQuery.CountAsync();

        var activeBarbers = await _context.Barbers.CountAsync(b => b.IsActive);

        BusiestBarberDto? busiestBarber = null;
        var topBarber = todayAppointments
            .Where(a => a.Status != AppointmentStatus.Cancelled && a.Barber != null)
            .GroupBy(a => new { a.BarberId, a.Barber!.Name })
            .Select(g => new { g.Key.Name, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefault();

        if (topBarber is not null)
        {
            busiestBarber = new BusiestBarberDto
            {
                Name = topBarber.Name,
                AppointmentsToday = topBarber.Count
            };
        }

        // UpcomingAppointments: citas no canceladas en las próximas 48h (a partir de mañana)
        var upcomingQuery = _context.Appointments
            .Include(a => a.Barber)
            .Where(a => a.AppointmentDate > tomorrow
                        && a.AppointmentDate <= now.AddHours(48)
                        && a.Status != AppointmentStatus.Cancelled);

        if (filterByUserId.HasValue)
            upcomingQuery = upcomingQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

        if (locationId.HasValue)
            upcomingQuery = upcomingQuery.Where(a => a.LocationId == locationId.Value);

        var upcomingCount = await upcomingQuery.CountAsync();

        // WeekRevenue: ingresos de citas completadas en la semana actual (lunes–domingo)
        var daysToMonday = (int)today.DayOfWeek == 0 ? 6 : (int)today.DayOfWeek - 1;
        var startOfWeek = today.AddDays(-daysToMonday);
        var endOfWeek = startOfWeek.AddDays(7);

        var weekRevenueQuery = _context.Appointments
            .Include(a => a.Service)
            .Include(a => a.Barber)
            .Where(a => a.AppointmentDate >= startOfWeek
                        && a.AppointmentDate < endOfWeek
                        && a.Status == AppointmentStatus.Completed
                        && a.Service != null);

        if (filterByUserId.HasValue)
            weekRevenueQuery = weekRevenueQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);

        if (locationId.HasValue)
            weekRevenueQuery = weekRevenueQuery.Where(a => a.LocationId == locationId.Value);

        var weekRevenueList = await weekRevenueQuery.ToListAsync();
        var weekRevenue = weekRevenueList.Where(a => a.Service != null).Sum(a => a.Service!.Price);

        var todayWalkIns = todayAppointments.Count(a => a.IsWalkIn && a.Status != AppointmentStatus.Cancelled);

        var totalWalkInsQuery = _context.Appointments
            .Where(a => a.IsWalkIn && a.Status != AppointmentStatus.Cancelled);
        if (filterByUserId.HasValue)
            totalWalkInsQuery = totalWalkInsQuery.Where(a => a.Barber != null && a.Barber.UserId == filterByUserId.Value);
        if (locationId.HasValue)
            totalWalkInsQuery = totalWalkInsQuery.Where(a => a.LocationId == locationId.Value);
        var totalWalkIns = await totalWalkInsQuery.CountAsync();

        return new DashboardStatsDto
        {
            TodayAppointments    = todayCount,
            TodayRevenue         = todayRevenue,
            PendingAppointments  = pendingCount,
            TotalActiveBarbers   = activeBarbers,
            BusiestBarber        = busiestBarber,
            UpcomingAppointments = upcomingCount,
            WeekRevenue          = weekRevenue,
            TodayWalkIns         = todayWalkIns,
            TotalWalkIns         = totalWalkIns
        };
    }

    public async Task<List<DailyRevenueDto>> GetWeeklyRevenueAsync(Guid? locationId = null, int days = 7)
    {
        if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
            throw new InvalidOperationException("TenantId not resolved for dashboard query.");

        var colombiaOffset = TimeSpan.FromHours(-5);
        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
        var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
        var startDate = today.AddDays(-(days - 1));

        var revenueQuery = _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.AppointmentDate >= startDate
                        && a.AppointmentDate < today.AddDays(1)
                        && a.Status == AppointmentStatus.Completed
                        && a.Service != null);

        if (locationId.HasValue)
            revenueQuery = revenueQuery.Where(a => a.LocationId == locationId.Value);

        var completedAppointments = await revenueQuery.ToListAsync();

        var revenueByDate = completedAppointments
            .GroupBy(a => a.AppointmentDate.Date)
            .ToDictionary(g => g.Key, g => new
            {
                Revenue = g.Sum(a => a.Service!.Price),
                Count = g.Count()
            });

        string[] dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

        var result = new List<DailyRevenueDto>();
        for (var i = -(days - 1); i <= 0; i++)
        {
            var date = today.AddDays(i);
            var dayOfWeek = (int)date.DayOfWeek;
            var dayName = dayNames[dayOfWeek == 0 ? 6 : dayOfWeek - 1];

            revenueByDate.TryGetValue(date, out var data);
            result.Add(new DailyRevenueDto
            {
                Day = dayName,
                Date = date.ToString("yyyy-MM-dd"),
                Revenue = data?.Revenue ?? 0,
                Appointments = data?.Count ?? 0
            });
        }

        return result;
    }

    public async Task<List<BarberEarningsDto>> GetBarberEarningsAsync(int days, Guid? locationId = null)
    {
        if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
            throw new InvalidOperationException("TenantId not resolved for dashboard query.");

        var colombiaOffset = TimeSpan.FromHours(-5);
        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
        var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
        var startDate = today.AddDays(-(days - 1));
        var endDate = today.AddDays(1);

        var barbersQuery = _context.Barbers.AsQueryable();
        if (locationId.HasValue)
            barbersQuery = barbersQuery.Where(b => b.LocationId == locationId.Value);

        var barbers = await barbersQuery.Select(b => new { b.Id, b.Name }).ToListAsync();

        var appointmentsQuery = _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.AppointmentDate >= startDate
                        && a.AppointmentDate < endDate
                        && a.Status == AppointmentStatus.Completed
                        && a.Service != null);

        if (locationId.HasValue)
            appointmentsQuery = appointmentsQuery.Where(a => a.LocationId == locationId.Value);

        var appointments = await appointmentsQuery
            .Select(a => new { a.BarberId, Price = a.Service!.Price })
            .ToListAsync();

        var grouped = appointments
            .GroupBy(a => a.BarberId)
            .ToDictionary(g => g.Key, g => new
            {
                Revenue = g.Sum(a => a.Price),
                Count = g.Count()
            });

        return barbers
            .Select(b =>
            {
                grouped.TryGetValue(b.Id, out var stats);
                return new BarberEarningsDto(b.Id, b.Name, stats?.Revenue ?? 0m, stats?.Count ?? 0);
            })
            .OrderByDescending(x => x.Revenue)
            .ToList();
    }

    public async Task<PeriodStatsDto> GetPeriodStatsAsync(int days, Guid? locationId = null)
    {
        if (string.IsNullOrWhiteSpace(_tenantService.TenantId))
            throw new InvalidOperationException("TenantId not resolved for dashboard query.");

        var colombiaOffset = TimeSpan.FromHours(-5);
        var colombiaNow = DateTimeOffset.UtcNow.ToOffset(colombiaOffset).DateTime;
        var today = DateTime.SpecifyKind(colombiaNow.Date, DateTimeKind.Utc);
        var startDate = today.AddDays(-(days - 1));
        var endDate = today.AddDays(1);

        var appointmentsQuery = _context.Appointments
            .Include(a => a.Service)
            .Where(a => a.AppointmentDate >= startDate
                        && a.AppointmentDate < endDate
                        && a.Status != AppointmentStatus.Cancelled);

        if (locationId.HasValue)
            appointmentsQuery = appointmentsQuery.Where(a => a.LocationId == locationId.Value);

        var appointments = await appointmentsQuery.ToListAsync();

        var totalRevenue = appointments
            .Where(a => a.Status == AppointmentStatus.Completed && a.Service != null)
            .Sum(a => a.Service!.Price);

        var totalWalkIns = appointments.Count(a => a.IsWalkIn);

        var newCustomers = await _context.Customers
            .CountAsync(c => c.CreatedAt >= startDate && c.CreatedAt < endDate);

        return new PeriodStatsDto
        {
            TotalAppointments = appointments.Count,
            TotalRevenue      = totalRevenue,
            NewCustomers      = newCustomers,
            TotalWalkIns      = totalWalkIns
        };
    }
}