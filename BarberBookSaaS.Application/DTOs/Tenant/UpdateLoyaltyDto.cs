using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Tenant;

public class UpdateLoyaltyDto
{
    public bool Enabled { get; set; }
    [Range(1, 1000)] public int Threshold { get; set; } = 10;
    public Guid? RewardServiceId { get; set; }
}