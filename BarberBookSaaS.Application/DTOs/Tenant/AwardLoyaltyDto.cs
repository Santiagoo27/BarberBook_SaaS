using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Tenant;

public class AwardLoyaltyDto
{
    [Required]
    public Guid CustomerId { get; set; }

    [Range(1, 1000)]
    public int Points { get; set; } = 1;
}