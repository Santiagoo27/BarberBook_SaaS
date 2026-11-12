using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Customers;

public class RegisterCustomerDto
{
    [Required] public string Name { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^\+?(?:[\s\-\(\)]*\d){7,15}[\s\-\(\)]*$",
        ErrorMessage = "Ingresa un número de teléfono válido (7 a 15 dígitos, con o sin código de país).")]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [MinLength(6, ErrorMessage = "La contraseña debe tener mínimo 6 caracteres.")]
    public string Password { get; set; } = string.Empty;
}