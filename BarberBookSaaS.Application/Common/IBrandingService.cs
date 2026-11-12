using BarberBookSaaS.Application.DTOs.Branding;

namespace BarberBookSaaS.Application.Common;

public interface IBrandingService
{
    Task<TenantBrandingDto?> GetBrandingAsync();
    Task<bool> UpdateBrandingAsync(UpdateBrandingDto dto);
    Task<bool> UpdateLogoAsync(string base64Logo);
    Task<TenantBrandingDto?> GetPublicBrandingAsync(string subdomain);
    Task<bool> UpdateWhatsAppAsync(bool enabled, string? phone);
    Task<bool> UpdateHolidaysAsync(bool enabled);
    Task<bool> UpdateAddressAsync(string? address);
    Task<bool> UpdateNameAsync(string name);
}