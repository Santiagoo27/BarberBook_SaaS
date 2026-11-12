using BarberBookSaaS.Domain.Entities;

namespace BarberBookSaaS.Application.DTOs.Appointments;

public class BookingResult
{
    public bool Success { get; init; }
    public Appointment? Appointment { get; init; }
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }

    public static BookingResult Ok(Appointment appointment) =>
        new() { Success = true, Appointment = appointment };

    public static BookingResult Fail(string errorCode, string errorMessage) =>
        new() { Success = false, ErrorCode = errorCode, ErrorMessage = errorMessage };
}