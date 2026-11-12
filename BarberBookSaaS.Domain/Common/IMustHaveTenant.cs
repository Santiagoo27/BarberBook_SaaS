namespace BarberBookSaaS.Domain.Common;

// Este es el contrato. Todo lo que firme este contrato tendrá un TenantId obligatorio.
public interface IMustHaveTenant
{
    public string TenantId { get; set; }
}