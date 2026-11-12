using BarberBookSaaS.Application.DTOs.Tenant;

namespace BarberBookSaaS.Application.Common;

public interface ILoyaltyService
{
    Task<LoyaltyConfigDto?> GetLoyaltyConfigAsync();
    Task<bool> UpdateLoyaltyConfigAsync(UpdateLoyaltyDto dto);
    Task<bool> AwardLoyaltyAsync(AwardLoyaltyDto dto);
}