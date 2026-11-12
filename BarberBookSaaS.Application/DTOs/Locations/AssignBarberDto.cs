using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Locations;

public class AssignBarberDto
{
    [Required] public Guid BarberId { get; set; }
}
