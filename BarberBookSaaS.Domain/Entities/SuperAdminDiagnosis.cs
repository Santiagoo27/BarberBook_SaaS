namespace BarberBookSaaS.Domain.Entities;

public class SuperAdminDiagnosis
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public string ResultJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
