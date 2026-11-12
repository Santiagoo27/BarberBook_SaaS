using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.DTOs.Barbers;

public class CreateBarberResponseDto
{
    public Barber Barber { get; set; } = null!;
    public string TemporaryPassword { get; set; } = string.Empty;
}