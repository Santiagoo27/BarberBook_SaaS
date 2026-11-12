namespace BarberBookSaaS.Application.DTOs.Appointments;

public class CreateAppointmentDto
{
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string? CustomerPhone { get; set; }
    public DateTime AppointmentDate { get; set; }
    public Guid? LocationId { get; set; }
}