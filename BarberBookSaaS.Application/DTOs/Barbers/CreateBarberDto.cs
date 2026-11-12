using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Barbers;

public class CreateBarberDto
{
    [Required][StringLength(100)] public string Name { get; set; } = string.Empty;
    [Required][EmailAddress][StringLength(200)] public string Email { get; set; } = string.Empty;
    [StringLength(20)] public string? Phone { get; set; }
    [StringLength(100)] public string Specialty { get; set; } = string.Empty;
}