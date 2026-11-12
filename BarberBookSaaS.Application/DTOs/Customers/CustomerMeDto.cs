namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerMeDto
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; }
    public int LoyaltyThreshold { get; set; }
    public bool LoyaltyEnabled { get; set; }
    public Guid? LoyaltyRewardServiceId { get; set; }
    public string? LoyaltyRewardServiceName { get; set; }
}