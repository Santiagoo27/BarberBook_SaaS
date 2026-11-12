using BarberBookSaaS.Application.Common;
using BarberBookSaaS.Application.DTOs.Branding;
using BarberBookSaaS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BarberBookSaaS.Infrastructure.Services;

public class BrandingService : IBrandingService
{
    private readonly ApplicationDbContext _context;
    private readonly ITenantService _tenantService;

    public BrandingService(ApplicationDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task<TenantBrandingDto?> GetBrandingAsync()
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return null;

        return new TenantBrandingDto
        {
            Theme = tenant.Theme,
            PrimaryColor = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64 = tenant.LogoBase64,
            Name = tenant.Name,
            Address = tenant.Address,
            Plan = tenant.Plan,
            WhatsAppEnabled = tenant.WhatsAppEnabled,
            WhatsAppPhone = tenant.WhatsAppPhone,
            HolidaysEnabled = tenant.HolidaysEnabled
        };
    }

    public async Task<bool> UpdateBrandingAsync(UpdateBrandingDto dto)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.Theme = dto.Theme;
        tenant.PrimaryColor = dto.PrimaryColor;
        tenant.SecondaryColor = dto.SecondaryColor;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateLogoAsync(string base64Logo)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.LogoBase64 = base64Logo;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateWhatsAppAsync(bool enabled, string? phone)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.WhatsAppEnabled = enabled;
        tenant.WhatsAppPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateHolidaysAsync(bool enabled)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.HolidaysEnabled = enabled;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateAddressAsync(string? address)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateNameAsync(string name)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == _tenantService.TenantId);

        if (tenant is null) return false;

        tenant.Name = string.IsNullOrWhiteSpace(name) ? tenant.Name : name.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<TenantBrandingDto?> GetPublicBrandingAsync(string subdomain)
    {
        var tenant = await _context.Tenants
            .FirstOrDefaultAsync(t => t.Subdomain == subdomain);

        if (tenant is null) return null;

        return new TenantBrandingDto
        {
            Theme = tenant.Theme,
            PrimaryColor = tenant.PrimaryColor,
            SecondaryColor = tenant.SecondaryColor,
            LogoBase64 = tenant.LogoBase64,
            Name = tenant.Name,
            Address = tenant.Address,
            Plan = tenant.Plan,
            HolidaysEnabled = tenant.HolidaysEnabled
        };
    }
}