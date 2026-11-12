using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Suggestion : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Type { get; set; } = "sugerencia"; // "queja" | "sugerencia"
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "Pendiente"; // "Pendiente" | "Leída"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
