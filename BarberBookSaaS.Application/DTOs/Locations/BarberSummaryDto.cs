namespace BarberBookSaaS.Application.DTOs.Locations;

public class BarberSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string? ImageBase64 { get; set; }
}
