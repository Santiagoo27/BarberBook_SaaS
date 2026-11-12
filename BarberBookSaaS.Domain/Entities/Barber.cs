using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Barber : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid? UserId { get; set; }
    public string? ImageBase64 { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }
}