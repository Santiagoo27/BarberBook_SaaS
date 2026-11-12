namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerAuthResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public int LoyaltyCount { get; set; }
}