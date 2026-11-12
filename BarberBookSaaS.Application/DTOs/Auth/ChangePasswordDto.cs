using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Auth;

public class ChangePasswordDto
{
    [MaxLength(72)] public string? CurrentPassword { get; set; }

    [Required]
    [MinLength(6, ErrorMessage = "La contraseña debe tener mínimo 6 caracteres.")]
    [MaxLength(72)]
    public string NewPassword { get; set; } = string.Empty;
}