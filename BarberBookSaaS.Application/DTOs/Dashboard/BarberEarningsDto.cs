namespace BarberBookSaaS.Application.DTOs.Dashboard;

public record BarberEarningsDto(
    Guid BarberId,
    string BarberName,
    decimal Revenue,
    int CompletedAppointments
);
