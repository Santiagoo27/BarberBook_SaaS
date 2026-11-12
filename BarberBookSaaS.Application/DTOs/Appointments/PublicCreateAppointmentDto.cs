namespace BarberBookSaaS.Application.DTOs.Appointments;

public class PublicCreateAppointmentDto
{
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public DateTime AppointmentDate { get; set; }
    public Guid? LocationId { get; set; }
}