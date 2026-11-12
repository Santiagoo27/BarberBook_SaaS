namespace BarberBookSaaS.Application.DTOs.Auth;

public record TenantLookupDto(string TenantId, string TenantName, string? LogoBase64);
