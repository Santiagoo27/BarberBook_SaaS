using System.ComponentModel.DataAnnotations;

namespace BarberBookSaaS.Application.DTOs;

public class AIDiagnosisRequestDto
{
    [Required]
    public string ImageBase64 { get; set; } = string.Empty;
}
