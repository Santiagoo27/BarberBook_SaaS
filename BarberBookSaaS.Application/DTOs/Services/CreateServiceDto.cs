using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Services;

public class CreateServiceDto
{
    [Required][StringLength(100)] public string Name { get; set; } = string.Empty;
    [Range(0.01, 99999.99)] public decimal Price { get; set; }
    [Range(1, 480)] public int DurationMinutes { get; set; }
    public string? ImageBase64 { get; set; }
}