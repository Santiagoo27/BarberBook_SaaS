using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Appointments;

public class UpdateAppointmentStatusDto
{
    [Required] public string Status { get; set; } = string.Empty;
}