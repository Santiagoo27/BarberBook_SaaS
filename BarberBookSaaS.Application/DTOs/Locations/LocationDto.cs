namespace BarberBookSaaS.Application.DTOs.Locations;

public class LocationDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int BarberCount { get; set; }
    public int ServiceCount { get; set; }
}
