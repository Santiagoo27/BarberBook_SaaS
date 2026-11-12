using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Locations;

public class AssignServiceDto
{
    [Required] public Guid ServiceId { get; set; }
}
