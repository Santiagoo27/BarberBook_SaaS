using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Locations;

public class UpdateLocationDto
{
    [Required] [MaxLength(100)] public string Name { get; set; } = string.Empty;
    [Required] [MaxLength(256)] public string Address { get; set; } = string.Empty;
}
