namespace BarberBookSaaS.Application.DTOs.Tenant;

public class LoyaltyConfigDto
{
    public bool Enabled { get; set; }
    public int Threshold { get; set; }
    public Guid? RewardServiceId { get; set; }
    public string? RewardServiceName { get; set; }
}