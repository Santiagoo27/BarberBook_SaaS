using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Review : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid? AppointmentId { get; set; }
    public Guid? CustomerId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
