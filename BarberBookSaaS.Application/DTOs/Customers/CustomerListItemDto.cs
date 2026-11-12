namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerListItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public int LoyaltyCount { get; set; }
    public DateTime CreatedAt { get; set; }
}