namespace BarberBookSaaS.Domain.Entities;

public class LocationService
{
    public Guid LocationId { get; set; }
    public Location Location { get; set; } = null!;
    public Guid ServiceId { get; set; }
    public Service Service { get; set; } = null!;
}
