using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Appointments;

public class CreateWalkInDto
{
    [Required]
    public Guid ServiceId { get; set; }

    [Required]
    [MaxLength(100)]
    public string CustomerName { get; set; } = string.Empty;

    public string? CustomerPhone { get; set; }

    public DateTime? AppointmentDate { get; set; }
}
