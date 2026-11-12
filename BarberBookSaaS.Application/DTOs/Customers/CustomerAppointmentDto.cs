namespace BarberBookSaaS.Application.DTOs.Customers;

public class CustomerAppointmentDto
{
    public Guid Id { get; set; }
    public Guid BarberId { get; set; }
    public Guid ServiceId { get; set; }
    public string BarberName { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public decimal ServicePrice { get; set; }
    public DateTime AppointmentDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsFree { get; set; }
    public string? CancelledBy { get; set; }
    public bool WasRescheduled { get; set; }
}