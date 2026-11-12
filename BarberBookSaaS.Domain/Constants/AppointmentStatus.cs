namespace BarberBookSaaS.Domain.Constants;

public static class AppointmentStatus
{
    public const string Pending   = "Pendiente";
    public const string Completed = "Completada";
    public const string Cancelled = "Cancelada";

    public static readonly IReadOnlyList<string> All = [Pending, Completed, Cancelled];

    public static bool IsValid(string? status) => status is not null && All.Contains(status);
}