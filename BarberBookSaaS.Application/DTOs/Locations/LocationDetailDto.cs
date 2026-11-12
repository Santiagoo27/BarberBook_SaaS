namespace BarberBookSaaS.Application.DTOs.Locations;

public class LocationDetailDto : LocationDto
{
    public List<BarberSummaryDto> Barbers { get; set; } = new();
    public List<ServiceSummaryDto> Services { get; set; } = new();
}
