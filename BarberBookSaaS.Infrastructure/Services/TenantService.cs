using BarberBookSaaS.Application.Common;

namespace BarberBookSaaS.Infrastructure.Services;

public class TenantService : ITenantService
{
    // Esta propiedad guardará el TenantId de la barbería durante el ciclo de vida de la petición HTTP
    public string TenantId { get; set; } = string.Empty;
}