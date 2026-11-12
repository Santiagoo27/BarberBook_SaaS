using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Auth;

public class ResetPasswordDto
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    [MinLength(6, ErrorMessage = "La contraseña debe tener mínimo 6 caracteres.")]
    public string NewPassword { get; set; } = string.Empty;
}
