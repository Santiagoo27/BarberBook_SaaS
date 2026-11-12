namespace BarberBookSaaS.Application.DTOs.Branding;

public class TenantBrandingDto
{
    public string Theme { get; set; } = "dark-premium";
    public string PrimaryColor { get; set; } = "#D4AF37";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string? LogoBase64 { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string Plan { get; set; } = "Standard";
    public bool WhatsAppEnabled { get; set; } = false;
    public string? WhatsAppPhone { get; set; }
    public bool HolidaysEnabled { get; set; } = false;
}