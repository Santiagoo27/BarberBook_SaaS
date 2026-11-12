namespace BarberBookSaaS.Domain.Entities;

public class Tenant
{
    // Almacena el identificador único de la barbería (PK)
    public string Id { get; set; } = string.Empty; // Usaremos el subdominio o un GUID como string
    public string Name { get; set; } = string.Empty;
    public string Subdomain { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? LogoUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
    public bool LoyaltyEnabled { get; set; } = false;
    public int LoyaltyThreshold { get; set; } = 10;
    public Guid? LoyaltyRewardServiceId { get; set; }
    public string Plan { get; set; } = "Standard";
    public bool IsWebActive { get; set; } = true;
    public bool WhatsAppEnabled { get; set; } = false;
    public string? WhatsAppPhone { get; set; }
    public bool HolidaysEnabled { get; set; } = false;
    public int AiDiagnosisUsed { get; set; } = 0;
    public DateTime? AiDiagnosisPeriodStart { get; set; }
}