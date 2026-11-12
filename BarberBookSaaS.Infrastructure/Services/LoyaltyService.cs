using Microsoft.EntityFrameworkCore;
using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Tenant;
using BarberBookSaaS.Infrastructure.Persistence;

namespace BarberBookSaaS.Infrastructure.Services;

public class LoyaltyService : ILoyaltyService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public LoyaltyService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<LoyaltyConfigDto?> GetLoyaltyConfigAsync()
    {
        var tenant = await _context.Tenants.FindAsync(_tenantService.TenantId);
        if (tenant is null) return null;

        string? rewardServiceName = null;
        if (tenant.LoyaltyRewardServiceId.HasValue)
        {
            rewardServiceName = await _context.Services
                .Where(s => s.Id == tenant.LoyaltyRewardServiceId.Value && s.TenantId == tenant.Id)
                .Select(s => s.Name)
                .FirstOrDefaultAsync();
        }

        return new LoyaltyConfigDto
        {
            Enabled = tenant.LoyaltyEnabled,
            Threshold = tenant.LoyaltyThreshold,
            RewardServiceId = tenant.LoyaltyRewardServiceId,
            RewardServiceName = rewardServiceName
        };
    }

    public async Task<bool> UpdateLoyaltyConfigAsync(UpdateLoyaltyDto dto)
    {
        var tenant = await _context.Tenants.FindAsync(_tenantService.TenantId);
        if (tenant is null) return false;

        tenant.LoyaltyEnabled = dto.Enabled;
        tenant.LoyaltyThreshold = dto.Threshold;
        tenant.LoyaltyRewardServiceId = dto.RewardServiceId;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AwardLoyaltyAsync(AwardLoyaltyDto dto)
    {
        var customer = await _context.Customers.FindAsync(dto.CustomerId);
        if (customer is null || customer.TenantId != _tenantService.TenantId) return false;

        customer.LoyaltyCount += dto.Points;
        await _context.SaveChangesAsync();
        return true;
    }
}