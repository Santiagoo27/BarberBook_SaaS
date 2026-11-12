namespace BarberBookSaaS.Application.Common;

public interface ITenantService
{
    // CORREGIDO: Se añadió 'set;' para permitir que el TenantMiddleware asigne la barbería detectada
    string TenantId { get; set; }
}