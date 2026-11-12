namespace BarberBookSaaS.Application.DTOs.Appointments;

public class AvailabilitySlotDto
{
    public string Time { get; set; } = string.Empty;
    public bool Available { get; set; }
}