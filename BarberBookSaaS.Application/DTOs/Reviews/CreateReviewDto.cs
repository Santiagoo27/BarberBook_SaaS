using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs.Reviews;

public class CreateReviewDto
{
    public Guid? AppointmentId { get; set; }

    [Range(1, 5)]
    public int Rating { get; set; }

    [MaxLength(500)]
    public string? Comment { get; set; }
}
