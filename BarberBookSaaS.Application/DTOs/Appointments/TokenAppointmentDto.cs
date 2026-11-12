namespace BarberBookSaaS.Application.DTOs.Appointments;

public class TokenAppointmentDto
{
    public string Subdomain { get; set; } = string.Empty;
    public string? TenantName { get; set; }
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
    public string? LogoUrl { get; set; }

    public Guid AppointmentId { get; set; }
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string BarberName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool CanReschedule { get; set; }
}
