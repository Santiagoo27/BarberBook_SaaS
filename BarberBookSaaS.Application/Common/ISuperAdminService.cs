using BarberBookSaaS.Application.DTOs.Auth;
using BarberBookSaaS.Application.DTOs.SuperAdmin;

namespace BarberBookSaaS.Application.Common;

public interface ISuperAdminService
{
    Task<List<TenantSummaryDto>> ListTenantsAsync();
    Task<string?> CreateTenantAsync(RegisterTenantDto request);
    Task<bool> UpdatePlanAsync(string tenantId, string plan);
    Task<bool> UpdateStatusAsync(string tenantId, bool isWebActive);
    Task<bool> DeleteTenantAsync(string tenantId);
}
