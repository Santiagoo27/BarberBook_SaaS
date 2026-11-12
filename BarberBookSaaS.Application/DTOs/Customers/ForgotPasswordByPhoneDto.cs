using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Customers;

public class ForgotPasswordByPhoneDto
{
    [Required]
    public string Phone { get; set; } = string.Empty;
}
