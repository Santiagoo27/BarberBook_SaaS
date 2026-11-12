using BarberBookSaaS.Domain.Common;

namespace BarberBookSaaS.Domain.Entities;

public class Service : IMustHaveTenant
{
    public Guid Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    
    // Almacena el tiempo estimado del servicio en minutos (Requisito Módulo 4)
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ImageBase64 { get; set; }
}