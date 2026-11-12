using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Application.DTOs.SuperAdmin;
using BarberBookSaaS.Domain.Constants;
using BarberBookSaaS.Domain.Entities;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class SuperAdminService : ISuperAdminService
{
    private readonly ApplicationDbContext _context;
    private readonly IAuthService _authService;

    public SuperAdminService(ApplicationDbContext context, IAuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    public async Task<List<TenantSummaryDto>> ListTenantsAsync()
    {
        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .OrderBy(t => t.Name)
            .ToListAsync();

        var now = DateTime.UtcNow;
        var result = new List<TenantSummaryDto>();
        foreach (var t in tenants)
        {
            var admin = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.TenantId == t.Id && u.Role == UserRoles.Admin);

            var appointments = await _context.Appointments
                .IgnoreQueryFilters()
                .CountAsync(a => a.TenantId == t.Id);

            var barbers = await _context.Barbers
                .IgnoreQueryFilters()
                .CountAsync(b => b.TenantId == t.Id && b.IsActive);

            // Current 30-day billing period starting from CreatedAt
            var periodsElapsed = (int)Math.Floor((now - t.CreatedAt).TotalDays / 30);
            var periodStart = t.CreatedAt.AddDays(periodsElapsed * 30);

            var diagnoses = await _context.Appointments
                .IgnoreQueryFilters()
                .CountAsync(a => a.TenantId == t.Id && a.AiDiagnosisJson != null
                                 && a.AppointmentDate >= periodStart);

            const int PremiumMonthlyLimit = 100;
            int diagnosisRemaining;
            if (t.Plan == "Standard")
                diagnosisRemaining = -2;
            else if (t.Plan == "PremiumUnlimited")
                diagnosisRemaining = -1;
            else // Premium — remaining = limit minus diagnoses already done this billing period
                diagnosisRemaining = Math.Max(0, PremiumMonthlyLimit - diagnoses);

            result.Add(new TenantSummaryDto
            {
                Id                 = t.Id,
                Name               = t.Name,
                Phone              = t.Phone,
                Address            = t.Address,
                Theme              = t.Theme,
                AdminEmail         = admin?.Email ?? "—",
                TotalAppointments  = appointments,
                TotalBarbers       = barbers,
                TotalDiagnoses     = diagnoses,
                Plan               = t.Plan,
                IsWebActive        = t.IsWebActive,
                WhatsAppEnabled    = t.WhatsAppEnabled,
                CreatedAt          = t.CreatedAt,
                CurrentPeriodStart = periodStart,
                DiagnosisRemaining = diagnosisRemaining,
            });
        }
        return result;
    }

    public Task<string?> CreateTenantAsync(RegisterTenantDto request)
        => _authService.RegisterTenantAsync(request);

    private const string AiServiceName = "Corte + Diagnóstico IA";

    public async Task<bool> UpdatePlanAsync(string tenantId, string plan)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant is null) return false;

        tenant.Plan = plan;

        var aiService = await _context.Services
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.Name == AiServiceName);

        if (plan == "Premium" || plan == "PremiumUnlimited")
        {
            if (aiService is null)
            {
                _context.Services.Add(new Service
                {
                    TenantId = tenantId,
                    Name = AiServiceName,
                    Price = 0,
                    DurationMinutes = 60,
                    IsActive = true
                });
            }
            else
            {
                aiService.IsActive = true;
            }
        }
        else
        {
            if (aiService is not null)
                aiService.IsActive = false;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateStatusAsync(string tenantId, bool isWebActive)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant is null) return false;
        tenant.IsWebActive = isWebActive;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteTenantAsync(string tenantId)
    {
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId);
        if (tenant is null) return false;

        // Delete in FK dependency order so SQLite doesn't complain
        _context.Appointments.RemoveRange(
            await _context.Appointments.IgnoreQueryFilters().Where(a => a.TenantId == tenantId).ToListAsync());
        _context.Reviews.RemoveRange(
            await _context.Reviews.IgnoreQueryFilters().Where(r => r.TenantId == tenantId).ToListAsync());
        _context.Suggestions.RemoveRange(
            await _context.Suggestions.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ToListAsync());
        _context.BarberSchedules.RemoveRange(
            await _context.BarberSchedules.IgnoreQueryFilters().Where(bs => bs.TenantId == tenantId).ToListAsync());

        var locationIds = await _context.Locations
            .IgnoreQueryFilters().Where(l => l.TenantId == tenantId)
            .Select(l => l.Id).ToListAsync();
        _context.LocationServices.RemoveRange(
            await _context.LocationServices.IgnoreQueryFilters().Where(ls => locationIds.Contains(ls.LocationId)).ToListAsync());

        _context.Barbers.RemoveRange(
            await _context.Barbers.IgnoreQueryFilters().Where(b => b.TenantId == tenantId).ToListAsync());
        _context.Services.RemoveRange(
            await _context.Services.IgnoreQueryFilters().Where(s => s.TenantId == tenantId).ToListAsync());
        _context.Locations.RemoveRange(
            await _context.Locations.IgnoreQueryFilters().Where(l => l.TenantId == tenantId).ToListAsync());
        _context.Customers.RemoveRange(
            await _context.Customers.IgnoreQueryFilters().Where(c => c.TenantId == tenantId).ToListAsync());
        _context.Users.RemoveRange(
            await _context.Users.IgnoreQueryFilters().Where(u => u.TenantId == tenantId).ToListAsync());
        _context.Tenants.Remove(tenant);

        await _context.SaveChangesAsync();
        return true;
    }
}
