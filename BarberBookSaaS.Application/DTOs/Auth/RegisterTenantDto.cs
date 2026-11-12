using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Auth;

public class RegisterTenantDto
{
    [Required]
    [MaxLength(100)]
    public string BarberiaName { get; set; } = string.Empty;

    [Required]
    [MinLength(3)]
    [MaxLength(30)]
    [RegularExpression(@"^[a-z0-9]+(-[a-z0-9]+)*$",
        ErrorMessage = "El subdominio solo puede contener letras minúsculas, números y guiones (sin espacios ni caracteres especiales).")]
    public string Subdomain { get; set; } = string.Empty;

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(200)]
    public string? Address { get; set; }

    [Required]
    [EmailAddress]
    [MaxLength(100)]
    public string AdminEmail { get; set; } = string.Empty;
}
