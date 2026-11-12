using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Customers;

public class LoginCustomerDto
{
    [Required] public string Phone { get; set; } = string.Empty;
    [Required] public string Password { get; set; } = string.Empty;
}